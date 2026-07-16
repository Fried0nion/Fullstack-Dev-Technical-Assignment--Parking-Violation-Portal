// Package violations handles violation submission (with photo upload),
// listing, and detail lookup. Submission orchestrates rules.GetActive
// and fines.Calculate/CreateInvoice as plain Go function calls in one
// synchronous request — no HTTP hop between packages.
package violations

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"parking-portal/internal/fines"
	"parking-portal/internal/rules"
	"parking-portal/internal/users"
)

// ErrNotFound is returned when a violation id doesn't exist.
var ErrNotFound = errors.New("violation not found")

// ContextUser extracts the authenticated user's id and role from the
// request, the same shape as auth.UserFromContext. Passed in from
// main.go so this package doesn't import internal/auth directly.
type ContextUser func(r *http.Request) (userID int, role string, err error)

// Violation mirrors a row in the violations table.
type Violation struct {
	ID            int       `json:"id"`
	Plate         string    `json:"plate"`
	ViolationType string    `json:"violation_type"`
	Location      string    `json:"location"`
	Timestamp     time.Time `json:"timestamp"`
	PhotoPath     *string   `json:"photo_path,omitempty"`
	SubmittedBy   int       `json:"submitted_by"`
	InvoiceStatus string    `json:"invoice_status,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

// SubmitResponse is returned by POST /violations: the created
// violation together with the invoice generated for it.
type SubmitResponse struct {
	Violation Violation     `json:"violation"`
	Invoice   fines.Invoice `json:"invoice"`
}

// Service handles violation submission, listing, and lookup. It calls
// rules and fines directly as Go function calls (no HTTP), per the
// in-process request flow in The Plan.
type Service struct {
	db         *sql.DB
	rules      *rules.Service
	fines      *fines.Service
	users      *users.Service
	uploadsDir string
}

func NewService(db *sql.DB, rulesSvc *rules.Service, finesSvc *fines.Service, usersSvc *users.Service, uploadsDir string) *Service {
	if uploadsDir == "" {
		uploadsDir = "./uploads"
	}
	return &Service{db: db, rules: rulesSvc, fines: finesSvc, users: usersSvc, uploadsDir: uploadsDir}
}

// acceptedTimestampLayouts covers the formats we expect from curl
// (RFC3339) and from an HTML <input type="datetime-local"> (no
// timezone, with or without seconds).
var acceptedTimestampLayouts = []string{
	time.RFC3339,
	"2006-01-02T15:04:05",
	"2006-01-02T15:04",
	"2006-01-02 15:04:05",
}

func parseTimestamp(s string) (time.Time, error) {
	for _, layout := range acceptedTimestampLayouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unrecognized timestamp format: %q", s)
}

// SubmitHandler handles POST /violations (officer-only, enforced by
// the caller checking role before invoking this — see Router). Expects
// a multipart form: plate, violation_type, location, timestamp, and an
// optional photo file.
func (s *Service) SubmitHandler(userFromContext ContextUser) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		submittedBy, role, err := userFromContext(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "no authenticated user")
			return
		}
		if role != "officer" {
			writeError(w, http.StatusForbidden, "only officers can submit violations")
			return
		}

		if err := r.ParseMultipartForm(10 << 20); err != nil {
			writeError(w, http.StatusBadRequest, "invalid multipart form")
			return
		}

		plate := strings.TrimSpace(r.FormValue("plate"))
		violationType := strings.TrimSpace(r.FormValue("violation_type"))
		location := strings.TrimSpace(r.FormValue("location"))
		timestampStr := strings.TrimSpace(r.FormValue("timestamp"))

		if plate == "" || violationType == "" || location == "" || timestampStr == "" {
			writeError(w, http.StatusBadRequest, "plate, violation_type, location, and timestamp are required")
			return
		}

		ts, err := parseTimestamp(timestampStr)
		if err != nil {
			writeError(w, http.StatusBadRequest, "timestamp must be RFC3339 or YYYY-MM-DDTHH:MM")
			return
		}

		var (
			photoPath *string
			photoFile io.ReadCloser
			photoName string
		)
		if file, header, ferr := r.FormFile("photo"); ferr == nil {
			photoFile = file
			photoName = header.Filename
		} else if !errors.Is(ferr, http.ErrMissingFile) {
			writeError(w, http.StatusBadRequest, "invalid photo upload")
			return
		}

		tx, err := s.db.Begin()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to save violation")
			return
		}
		defer tx.Rollback()

		res, err := tx.Exec(
			`INSERT INTO violations (plate, violation_type, location, timestamp, photo_path, submitted_by)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			plate, violationType, location, ts, nullableString(photoPath), submittedBy,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to save violation")
			return
		}
		violationID64, err := res.LastInsertId()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to save violation")
			return
		}
		violationID := int(violationID64)

		activeRule, err := s.rules.GetActive()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "no active rule version to calculate a fine against")
			return
		}

		calc, err := s.fines.Calculate(plate, violationType, ts, activeRule)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}

		if photoFile != nil {
			defer photoFile.Close()
			savedPath, saveErr := s.savePhoto(photoFile, photoName)
			if saveErr != nil {
				writeError(w, http.StatusInternalServerError, "failed to save photo")
				return
			}
			photoPath = &savedPath
		}

		invoice, err := s.fines.CreateInvoiceTx(tx, violationID, calc)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create invoice")
			return
		}

		if err := tx.Commit(); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to save violation")
			return
		}

		violation, err := s.get(violationID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "violation saved but could not be reloaded")
			return
		}

		writeJSON(w, http.StatusCreated, SubmitResponse{Violation: *violation, Invoice: *invoice})
	}
}

// savePhoto writes the uploaded file to uploadsDir/{uuid}{ext} and
// returns the relative path stored on the violation row.
func (s *Service) savePhoto(file io.Reader, originalFilename string) (string, error) {
	if err := os.MkdirAll(s.uploadsDir, 0o755); err != nil {
		return "", err
	}

	ext := filepath.Ext(originalFilename)
	filename := uuid.New().String() + ext
	fullPath := filepath.Join(s.uploadsDir, filename)

	out, err := os.Create(fullPath)
	if err != nil {
		return "", err
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		return "", err
	}

	return fullPath, nil
}

func nullableString(s *string) any {
	if s == nil {
		return nil
	}
	return *s
}

const violationColumns = `id, plate, violation_type, location, timestamp, photo_path, submitted_by, COALESCE((SELECT status FROM invoices WHERE violation_id = violations.id LIMIT 1), 'pending') AS invoice_status, created_at`

func scanViolation(scan func(dest ...any) error) (*Violation, error) {
	var (
		v         Violation
		photoPath sql.NullString
		status    string
	)
	if err := scan(&v.ID, &v.Plate, &v.ViolationType, &v.Location, &v.Timestamp,
		&photoPath, &v.SubmittedBy, &status, &v.CreatedAt); err != nil {
		return nil, err
	}
	if photoPath.Valid {
		v.PhotoPath = &photoPath.String
	}
	v.InvoiceStatus = status
	return &v, nil
}

// get fetches a single violation by id.
func (s *Service) get(id int) (*Violation, error) {
	row := s.db.QueryRow(`SELECT `+violationColumns+` FROM violations WHERE id = ?`, id)
	v, err := scanViolation(row.Scan)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return v, nil
}

// memberPlate looks up the plate on file for a member user id.
// Queried directly rather than through internal/users (Task 5) to
// avoid a premature cross-package dependency for a single column read.
func (s *Service) memberPlate(userID int) (string, error) {
	var plate sql.NullString
	err := s.db.QueryRow(`SELECT plate FROM users WHERE id = ?`, userID).Scan(&plate)
	if err != nil {
		return "", err
	}
	return plate.String, nil
}

// ListHandler handles GET /violations. Officers see every violation;
// members see only violations matching the plate on their profile.
func (s *Service) ListHandler(userFromContext ContextUser) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, role, err := userFromContext(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "no authenticated user")
			return
		}

		var rows *sql.Rows
		if role == "officer" {
			rows, err = s.db.Query(`SELECT ` + violationColumns + ` FROM violations ORDER BY created_at DESC`)
		} else {
			plate, plateErr := s.memberPlate(userID)
			if plateErr != nil {
				writeError(w, http.StatusInternalServerError, "failed to look up member profile")
				return
			}
			if plate == "" {
				writeJSON(w, http.StatusOK, []Violation{})
				return
			}
			rows, err = s.db.Query(`SELECT `+violationColumns+` FROM violations WHERE plate = ? ORDER BY created_at DESC`, plate)
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list violations")
			return
		}
		defer rows.Close()

		out := []Violation{}
		for rows.Next() {
			v, err := scanViolation(rows.Scan)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to read violations")
				return
			}
			out = append(out, *v)
		}
		if err := rows.Err(); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read violations")
			return
		}

		writeJSON(w, http.StatusOK, out)
	}
}

// DetailHandler handles GET /violations/{id}. Officers can view any
// violation; members only one matching their own plate.
func (s *Service) DetailHandler(userFromContext ContextUser, id int) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, role, err := userFromContext(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "no authenticated user")
			return
		}

		violation, err := s.get(id)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				writeError(w, http.StatusNotFound, "violation not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "failed to load violation")
			return
		}

		if role != "officer" {
			plate, plateErr := s.memberPlate(userID)
			if plateErr != nil || plate == "" || plate != violation.Plate {
				writeError(w, http.StatusForbidden, "you do not have access to this violation")
				return
			}
		}

		invoice, err := s.fines.GetInvoiceByViolation(id)
		if err != nil && !errors.Is(err, fines.ErrInvoiceNotFound) {
			writeError(w, http.StatusInternalServerError, "failed to load invoice")
			return
		}

		officer, err := s.users.GetByID(violation.SubmittedBy)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to load officer profile")
			return
		}

		member, err := s.users.GetByPlate(violation.Plate)
		if err != nil && !errors.Is(err, users.ErrUserNotFound) {
			writeError(w, http.StatusInternalServerError, "failed to load member profile")
			return
		}

		resp := struct {
			Violation Violation      `json:"violation"`
			Invoice   *fines.Invoice `json:"invoice,omitempty"`
			Officer   *users.User    `json:"officer,omitempty"`
			Member    *users.User    `json:"member,omitempty"`
		}{Violation: *violation, Invoice: invoice, Officer: officer, Member: member}

		writeJSON(w, http.StatusOK, resp)
	}
}

// Router dispatches both /violations and /violations/{id}: GET/POST on
// the collection, GET on a single id. Mount it at both paths in
// main.go behind auth.Middleware (role checks happen inside, since
// list is shared across roles but submit is officer-only).
func (s *Service) Router(userFromContext ContextUser) http.HandlerFunc {
	list := s.ListHandler(userFromContext)
	submit := s.SubmitHandler(userFromContext)

	return func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/violations")
		path = strings.Trim(path, "/")

		if path == "" {
			switch r.Method {
			case http.MethodGet:
				list(w, r)
			case http.MethodPost:
				submit(w, r)
			default:
				writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			}
			return
		}

		id, err := strconv.Atoi(path)
		if err != nil {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		s.DetailHandler(userFromContext, id)(w, r)
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
