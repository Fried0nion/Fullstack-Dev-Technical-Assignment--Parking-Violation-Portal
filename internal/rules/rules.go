// Package rules manages fine rule versions: listing, publishing, and
// looking up the currently active version. GetActive is a plain Go
// function meant to be called in-process by other packages (e.g.
// violations/fines) — it is never exposed over HTTP.
package rules

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"
)

// ErrNoActiveRule is returned by GetActive when no rule version is
// currently marked active (should only happen before seeding).
var ErrNoActiveRule = errors.New("no active rule version")

// TimeMultipliers describes the day/night fine multiplier window.
type TimeMultipliers struct {
	Day            float64 `json:"day"`
	Night          float64 `json:"night"`
	NightStartHour int     `json:"night_start_hour"`
	NightEndHour   int     `json:"night_end_hour"`
}

// RuleVersion mirrors a row in rule_versions, with the JSON columns
// deserialized into typed sub-structs.
type RuleVersion struct {
	ID                int                `json:"id"`
	PublishedBy       int                `json:"published_by"`
	PublishedAt       time.Time          `json:"published_at"`
	IsActive          bool               `json:"is_active"`
	BaseAmounts       map[string]int     `json:"base_amounts"`
	TimeMultipliers   TimeMultipliers    `json:"time_multipliers"`
	RepeatMultipliers map[string]float64 `json:"repeat_multipliers"`
}

// PublishRequest is the payload for publishing a new rule version.
type PublishRequest struct {
	BaseAmounts       map[string]int     `json:"base_amounts"`
	TimeMultipliers   TimeMultipliers    `json:"time_multipliers"`
	RepeatMultipliers map[string]float64 `json:"repeat_multipliers"`
}

// Service manages rule versions against the rule_versions table.
type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

// scanRuleVersion scans a single rule_versions row, deserializing the
// JSON columns into the struct's typed fields.
func scanRuleVersion(scan func(dest ...any) error) (*RuleVersion, error) {
	var (
		rv              RuleVersion
		baseAmountsJSON string
		timeMultJSON    string
		repeatMultJSON  string
		isActive        int
	)

	if err := scan(&rv.ID, &rv.PublishedBy, &rv.PublishedAt, &isActive,
		&baseAmountsJSON, &timeMultJSON, &repeatMultJSON); err != nil {
		return nil, err
	}

	rv.IsActive = isActive != 0

	if err := json.Unmarshal([]byte(baseAmountsJSON), &rv.BaseAmounts); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(timeMultJSON), &rv.TimeMultipliers); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(repeatMultJSON), &rv.RepeatMultipliers); err != nil {
		return nil, err
	}

	return &rv, nil
}

const ruleVersionColumns = `id, published_by, published_at, is_active, base_amounts, time_multipliers, repeat_multipliers`

// GetActive returns the currently active rule version. Called directly
// by other packages (e.g. violations.Service) as a plain Go function —
// never exposed as an HTTP route.
func (s *Service) GetActive() (*RuleVersion, error) {
	row := s.db.QueryRow(`SELECT ` + ruleVersionColumns + ` FROM rule_versions WHERE is_active = 1 LIMIT 1`)
	rv, err := scanRuleVersion(row.Scan)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNoActiveRule
		}
		return nil, err
	}
	return rv, nil
}

// List returns all rule versions, most recently published first. The
// frontend identifies the active one via IsActive.
func (s *Service) List() ([]RuleVersion, error) {
	rows, err := s.db.Query(`SELECT ` + ruleVersionColumns + ` FROM rule_versions ORDER BY published_at DESC, id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []RuleVersion
	for rows.Next() {
		rv, err := scanRuleVersion(rows.Scan)
		if err != nil {
			return nil, err
		}
		out = append(out, *rv)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// Publish deactivates all existing rule versions and inserts a new
// active one, within a single transaction. Existing invoices reference
// their rule_version_id snapshot and are never retroactively affected.
func (s *Service) Publish(publishedBy int, payload PublishRequest) (*RuleVersion, error) {
	baseAmountsJSON, err := json.Marshal(payload.BaseAmounts)
	if err != nil {
		return nil, err
	}
	timeMultJSON, err := json.Marshal(payload.TimeMultipliers)
	if err != nil {
		return nil, err
	}
	repeatMultJSON, err := json.Marshal(payload.RepeatMultipliers)
	if err != nil {
		return nil, err
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`UPDATE rule_versions SET is_active = 0`); err != nil {
		return nil, err
	}

	res, err := tx.Exec(
		`INSERT INTO rule_versions (published_by, is_active, base_amounts, time_multipliers, repeat_multipliers)
		 VALUES (?, 1, ?, ?, ?)`,
		publishedBy, string(baseAmountsJSON), string(timeMultJSON), string(repeatMultJSON),
	)
	if err != nil {
		return nil, err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	row := tx.QueryRow(`SELECT `+ruleVersionColumns+` FROM rule_versions WHERE id = ?`, id)
	rv, err := scanRuleVersion(row.Scan)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return rv, nil
}

// ListHandler handles GET /rules — returns all rule versions.
func (s *Service) ListHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	versions, err := s.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list rule versions")
		return
	}
	if versions == nil {
		versions = []RuleVersion{}
	}

	writeJSON(w, http.StatusOK, versions)
}

// PublishHandler handles POST /rules — publishes a new rule version.
// userFromContext extracts the authenticated user id (the officer
// enforced by auth.RequireRole at the router level), who becomes
// published_by.
func (s *Service) PublishHandler(userFromContext func(r *http.Request) (int, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		var req PublishRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if len(req.BaseAmounts) == 0 {
			writeError(w, http.StatusBadRequest, "base_amounts is required")
			return
		}

		publishedBy, err := userFromContext(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "no authenticated user")
			return
		}

		rv, err := s.Publish(publishedBy, req)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to publish rule version")
			return
		}

		writeJSON(w, http.StatusCreated, rv)
	}
}

// Handler dispatches GET/POST for the /rules route to ListHandler /
// PublishHandler respectively.
func (s *Service) Handler(userFromContext func(r *http.Request) (int, error)) http.HandlerFunc {
	publish := s.PublishHandler(userFromContext)
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			s.ListHandler(w, r)
		case http.MethodPost:
			publish(w, r)
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
