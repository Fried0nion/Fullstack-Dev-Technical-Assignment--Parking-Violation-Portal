// Package payments handles a member paying an invoice against a mocked
// payment provider. Insufficient balance and a mock-provider "failed"
// scenario are kept as two distinct, explicit failure paths per The Plan:
// insufficient balance never reaches the mock at all (402, invoice stays
// pending), while a mock "failed" result rolls back the balance deduction
// and marks the invoice failed.
package payments

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"parking-portal/internal/fines"
	"parking-portal/internal/users"
)

// ContextUser extracts the authenticated user's id and role from the
// request — same pattern used by violations and users packages.
type ContextUser func(r *http.Request) (userID int, role string, err error)

// Payment mirrors a row in the payments table.
type Payment struct {
	ID                    int       `json:"id"`
	InvoiceID             int       `json:"invoice_id"`
	MemberID              int       `json:"member_id"`
	Scenario              string    `json:"scenario"`
	ProviderTransactionID string    `json:"provider_transaction_id"`
	Status                string    `json:"status"`
	CreatedAt             time.Time `json:"created_at"`
}

// PayRequest is the body for POST /payments.
type PayRequest struct {
	InvoiceID int    `json:"invoice_id"`
	Scenario  string `json:"scenario"` // "success" or "failed"
}

// PayResponse is returned by POST /payments.
type PayResponse struct {
	Status        string `json:"status"`
	TransactionID string `json:"transaction_id"`
}

// Service handles payments against the payments table, orchestrating
// fines.Service (invoice lookup + status transitions) and users.Service
// (balance deduct/refund) as plain Go function calls.
type Service struct {
	db    *sql.DB
	fines *fines.Service
	users *users.Service
}

func NewService(db *sql.DB, finesSvc *fines.Service, usersSvc *users.Service) *Service {
	return &Service{db: db, fines: finesSvc, users: usersSvc}
}

// charge is the mocked payment provider. It's pure and in-memory — no
// network call, no external state — and always "succeeds" at the
// transport level, returning a status of either "paid" or "failed"
// depending on the scenario the caller selected.
func charge(scenario string) (status string, transactionID string) {
	transactionID = uuid.New().String()
	if scenario == "success" {
		return "paid", transactionID
	}
	return "failed", transactionID
}

// violationPlate looks up the plate on the violation behind an invoice,
// queried directly rather than importing internal/violations, mirroring
// the same trade-off violations.Service made for internal/users in
// Task 4 (a single-column read doesn't justify a new package dependency).
func (s *Service) violationPlate(violationID int) (string, error) {
	var plate string
	err := s.db.QueryRow(
		`SELECT plate FROM violations WHERE id = ?`, violationID,
	).Scan(&plate)
	return plate, err
}

// insertPayment records a payment attempt.
func (s *Service) insertPayment(invoiceID, memberID int, scenario, transactionID, status string) (*Payment, error) {
	res, err := s.db.Exec(
		`INSERT INTO payments (invoice_id, member_id, scenario, provider_transaction_id, status)
		 VALUES (?, ?, ?, ?, ?)`,
		invoiceID, memberID, scenario, transactionID, status,
	)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	return s.getPayment(int(id))
}

const paymentColumns = `id, invoice_id, member_id, scenario, provider_transaction_id, status, created_at`

func scanPayment(scan func(dest ...any) error) (*Payment, error) {
	var p Payment
	var txID sql.NullString
	if err := scan(&p.ID, &p.InvoiceID, &p.MemberID, &p.Scenario, &txID, &p.Status, &p.CreatedAt); err != nil {
		return nil, err
	}
	p.ProviderTransactionID = txID.String
	return &p, nil
}

func (s *Service) getPayment(id int) (*Payment, error) {
	row := s.db.QueryRow(`SELECT `+paymentColumns+` FROM payments WHERE id = ?`, id)
	return scanPayment(row.Scan)
}

// PayHandler handles POST /payments (member-only, enforced by the
// caller mounting this behind auth.RequireRole("member") — see Router).
func (s *Service) PayHandler(userFromContext ContextUser) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, _, err := userFromContext(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "no authenticated user")
			return
		}

		var req PayRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if req.Scenario != "success" && req.Scenario != "failed" {
			writeError(w, http.StatusBadRequest, `scenario must be "success" or "failed"`)
			return
		}

		invoice, err := s.fines.GetInvoice(req.InvoiceID)
		if err != nil {
			if errors.Is(err, fines.ErrInvoiceNotFound) {
				writeError(w, http.StatusNotFound, "invoice not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "failed to load invoice")
			return
		}

		if invoice.Status == "failed" {
			if err := s.fines.UpdateInvoiceStatus(invoice.ID, "pending"); err != nil {
				writeError(w, http.StatusInternalServerError, "failed to reset invoice status")
				return
			}
			invoice.Status = "pending"
		} else if invoice.Status != "pending" {
			writeError(w, http.StatusConflict, "invoice is not pending")
			return
		}

		violationPlate, err := s.violationPlate(invoice.ViolationID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to verify invoice ownership")
			return
		}
		member, err := s.users.GetByID(userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to load member profile")
			return
		}
		if member.Plate == nil || *member.Plate != violationPlate {
			writeError(w, http.StatusForbidden, "this invoice does not belong to you")
			return
		}

		// Deduct balance before touching the mock provider. Insufficient
		// balance is a distinct, immediate failure: 402, invoice stays
		// pending, no payment row inserted, mock never called.
		if err := s.users.DeductBalance(userID, invoice.FineAmount); err != nil {
			if errors.Is(err, users.ErrInsufficientBalance) {
				writeError(w, http.StatusPaymentRequired, "insufficient balance")
				return
			}
			writeError(w, http.StatusInternalServerError, "failed to deduct balance")
			return
		}

		status, transactionID := charge(req.Scenario)

		if status == "paid" {
			if err := s.fines.UpdateInvoiceStatus(invoice.ID, "paid"); err != nil {
				writeError(w, http.StatusInternalServerError, "payment charged but failed to update invoice")
				return
			}
			if _, err := s.insertPayment(invoice.ID, userID, req.Scenario, transactionID, "paid"); err != nil {
				writeError(w, http.StatusInternalServerError, "payment charged but failed to record payment")
				return
			}
		} else {
			// Mock provider failure: roll back the balance deduction,
			// mark the invoice failed, and record the attempt.
			if err := s.users.RefundBalance(userID, invoice.FineAmount); err != nil {
				writeError(w, http.StatusInternalServerError, "payment failed and balance refund also failed")
				return
			}
			if err := s.fines.UpdateInvoiceStatus(invoice.ID, "failed"); err != nil {
				writeError(w, http.StatusInternalServerError, "failed to update invoice status")
				return
			}
			if _, err := s.insertPayment(invoice.ID, userID, req.Scenario, transactionID, "failed"); err != nil {
				writeError(w, http.StatusInternalServerError, "failed to record payment")
				return
			}
		}

		writeJSON(w, http.StatusOK, PayResponse{Status: status, TransactionID: transactionID})
	}
}

// ListHandler handles GET /payments — lists payment records for the
// current member, most recent first.
func (s *Service) ListHandler(userFromContext ContextUser) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, _, err := userFromContext(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "no authenticated user")
			return
		}

		rows, err := s.db.Query(
			`SELECT `+paymentColumns+` FROM payments WHERE member_id = ? ORDER BY created_at DESC`, userID,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list payments")
			return
		}
		defer rows.Close()

		out := []Payment{}
		for rows.Next() {
			p, err := scanPayment(rows.Scan)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to read payments")
				return
			}
			out = append(out, *p)
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read payments")
			return
		}

		writeJSON(w, http.StatusOK, out)
	}
}

// Router dispatches GET/POST /payments. Mount behind auth.Middleware +
// auth.RequireRole("member") in main.go — both routes are member-only.
func (s *Service) Router(userFromContext ContextUser) http.HandlerFunc {
	pay := s.PayHandler(userFromContext)
	list := s.ListHandler(userFromContext)

	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			list(w, r)
		case http.MethodPost:
			pay(w, r)
		default:
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
