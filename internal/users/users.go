// Package users manages member profiles and account balances.
// It exposes HTTP handlers for the /users/me routes and an exported
// DeductBalance function for use by internal/payments.
package users

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"
)

// ErrUserNotFound is returned when no user row exists for the given id.
var ErrUserNotFound = errors.New("user not found")

// ErrInsufficientBalance is returned by DeductBalance when the member's
// current balance is lower than the requested deduction amount. This is
// a distinct failure case from a mock-provider "failed" scenario — the
// payment handler checks for this before calling the mock, and surfaces
// it as 402 Payment Required without touching the invoice status.
var ErrInsufficientBalance = errors.New("insufficient balance")

// User is a safe, outward-facing view of a users row — password_hash
// is deliberately excluded.
type User struct {
	ID        int       `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	Plate     *string   `json:"plate"`
	Balance   int       `json:"balance"`
	CreatedAt time.Time `json:"created_at"`
}

// BalanceResponse is the payload for GET /users/me/balance.
type BalanceResponse struct {
	Balance int `json:"balance"`
}

// UpdatePlateRequest is the body for PATCH /users/me.
type UpdatePlateRequest struct {
	Plate string `json:"plate"`
}

// ContextUser extracts the authenticated user's id and role from the
// request — same pattern used by violations and rules packages.
type ContextUser func(r *http.Request) (userID int, role string, err error)

// Service manages user profiles and balances against the users table.
type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

// GetByID fetches a single user by id. Returns ErrUserNotFound if no
// such user exists.
func (s *Service) GetByID(id int) (*User, error) {
	row := s.db.QueryRow(
		`SELECT id, email, role, plate, balance, created_at FROM users WHERE id = ?`, id,
	)
	return scanUser(row.Scan)
}

// UpdatePlate sets the plate field on a member's user row.
func (s *Service) UpdatePlate(userID int, plate string) error {
	res, err := s.db.Exec(`UPDATE users SET plate = ? WHERE id = ?`, plate, userID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrUserNotFound
	}
	return nil
}

// DeductBalance subtracts amount from the user's balance inside a
// single UPDATE that also guards against going negative
// (WHERE balance >= amount). If no row is updated it means either
// the user doesn't exist or the balance was insufficient — we
// distinguish by re-reading the current balance.
//
// This is exported so internal/payments can call it directly as a Go
// function, with no HTTP hop.
func (s *Service) DeductBalance(userID int, amount int) error {
	res, err := s.db.Exec(
		`UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?`,
		amount, userID, amount,
	)
	if err != nil {
		return err
	}

	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 1 {
		return nil // success
	}

	// No row was updated — determine why.
	var balance int
	scanErr := s.db.QueryRow(`SELECT balance FROM users WHERE id = ?`, userID).Scan(&balance)
	if errors.Is(scanErr, sql.ErrNoRows) {
		return ErrUserNotFound
	}
	if scanErr != nil {
		return scanErr
	}
	// User exists but balance < amount.
	return ErrInsufficientBalance
}

// RefundBalance adds amount back to a user's balance. Used by
// internal/payments to roll back a balance deduction when the mock
// provider returns "failed".
func (s *Service) RefundBalance(userID int, amount int) error {
	res, err := s.db.Exec(
		`UPDATE users SET balance = balance + ? WHERE id = ?`,
		amount, userID,
	)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrUserNotFound
	}
	return nil
}

func scanUser(scan func(dest ...any) error) (*User, error) {
	var (
		u     User
		plate sql.NullString
	)
	if err := scan(&u.ID, &u.Email, &u.Role, &plate, &u.Balance, &u.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	if plate.Valid {
		u.Plate = &plate.String
	}
	return &u, nil
}

// MeHandler handles GET /users/me — returns the profile of the
// JWT-identified user.
func (s *Service) MeHandler(userFromContext ContextUser) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		userID, _, err := userFromContext(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "no authenticated user")
			return
		}

		user, err := s.GetByID(userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to load user profile")
			return
		}

		writeJSON(w, http.StatusOK, user)
	}
}

// UpdatePlateHandler handles PATCH /users/me — lets a member update
// their plate number.
func (s *Service) UpdatePlateHandler(userFromContext ContextUser) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		userID, _, err := userFromContext(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "no authenticated user")
			return
		}

		var req UpdatePlateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if req.Plate == "" {
			writeError(w, http.StatusBadRequest, "plate is required")
			return
		}

		if err := s.UpdatePlate(userID, req.Plate); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to update plate")
			return
		}

		user, err := s.GetByID(userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "plate updated but could not reload profile")
			return
		}

		writeJSON(w, http.StatusOK, user)
	}
}

// BalanceHandler handles GET /users/me/balance — returns the member's
// current balance as a lightweight response (used by the frontend
// header to poll balance after payment).
func (s *Service) BalanceHandler(userFromContext ContextUser) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		userID, _, err := userFromContext(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "no authenticated user")
			return
		}

		user, err := s.GetByID(userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to load user balance")
			return
		}

		writeJSON(w, http.StatusOK, BalanceResponse{Balance: user.Balance})
	}
}

// Router dispatches the /users/me and /users/me/balance routes.
// All routes require an authenticated user (caller wraps with
// auth.Middleware before registering in main.go).
func (s *Service) Router(userFromContext ContextUser) http.Handler {
	me := s.MeHandler(userFromContext)
	updatePlate := s.UpdatePlateHandler(userFromContext)
	balance := s.BalanceHandler(userFromContext)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/users/me":
			switch r.Method {
			case http.MethodGet:
				me(w, r)
			case http.MethodPatch:
				updatePlate(w, r)
			default:
				writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			}
		case "/users/me/balance":
			balance(w, r)
		default:
			writeError(w, http.StatusNotFound, "not found")
		}
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
