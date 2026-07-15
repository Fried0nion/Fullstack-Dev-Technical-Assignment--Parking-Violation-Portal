package auth

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"golang.org/x/crypto/bcrypt"
)

// ErrInvalidCredentials is returned by Login when the email doesn't exist
// or the password doesn't match. Deliberately doesn't distinguish which,
// so login can't be used to enumerate registered emails.
var ErrInvalidCredentials = errors.New("invalid email or password")

// Service handles authentication against the users table.
type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

// Login verifies email/password against the users table and returns a
// signed 24h JWT on success.
func (s *Service) Login(email, password string) (string, error) {
	var (
		userID       int
		passwordHash string
		role         string
	)

	row := s.db.QueryRow(`SELECT id, password_hash, role FROM users WHERE email = ?`, email)
	if err := row.Scan(&userID, &passwordHash, &role); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrInvalidCredentials
		}
		return "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)); err != nil {
		return "", ErrInvalidCredentials
	}

	return IssueToken(userID, role)
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token string `json:"token"`
}

// LoginHandler returns the POST /auth/login handler for this Service.
func (s *Service) LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	token, err := s.Login(req.Email, req.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(loginResponse{Token: token})
}
