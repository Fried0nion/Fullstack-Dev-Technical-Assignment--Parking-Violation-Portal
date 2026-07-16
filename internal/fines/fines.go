// Package fines calculates fine amounts against an active rule version
// and manages invoices: creation (immutable snapshot of the rule used),
// status transitions, lookup, and transaction history.
package fines

import (
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"time"

	"parking-portal/internal/rules"
)

// ErrUnknownViolationType is returned by Calculate when the active rule
// has no base amount configured for the given violation type.
var ErrUnknownViolationType = errors.New("no base amount configured for this violation type")

// ErrInvoiceNotFound is returned by GetInvoice when no invoice exists
// with the given id.
var ErrInvoiceNotFound = errors.New("invoice not found")

// Invoice mirrors a row in the invoices table. Once created, the
// rule_version_id, base_amount, time_multiplier, repeat_multiplier and
// fine_amount fields are an immutable snapshot — republishing a new
// rule version never changes an existing invoice.
type Invoice struct {
	ID               int       `json:"id"`
	ViolationID      int       `json:"violation_id"`
	RuleVersionID    int       `json:"rule_version_id"`
	BaseAmount       int       `json:"base_amount"`
	TimeMultiplier   float64   `json:"time_multiplier"`
	RepeatMultiplier float64   `json:"repeat_multiplier"`
	FineAmount       int       `json:"fine_amount"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
}

// HistoryRow is a denormalized view joining a violation with its
// invoice and the rule version that was applied, for the member-facing
// transaction history screen.
type HistoryRow struct {
	ViolationID          int       `json:"violation_id"`
	Plate                string    `json:"plate"`
	ViolationType        string    `json:"violation_type"`
	Location             string    `json:"location"`
	Timestamp            time.Time `json:"timestamp"`
	InvoiceID            int       `json:"invoice_id"`
	FineAmount           int       `json:"fine_amount"`
	Status               string    `json:"status"`
	RuleVersionID        int       `json:"rule_version_id"`
	RuleVersionPublished time.Time `json:"rule_version_published_at"`
}

// Service manages invoices against the invoices table, and reads
// violations for repeat-offense lookups and history joins.
type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

// Calculate computes the fine for a violation against the given active
// rule version. It does not touch the invoices table — the caller
// (violations.Service) inserts the violation row first, then passes the
// resulting violation id to CreateInvoice to persist the snapshot.
//
// repeat_multiplier is based on how many *other* violations for the
// same plate are currently unpaid — status IN ('pending', 'failed') —
// and occurred within the last 90 days. "Unpaid" means anything that
// is not paid, per The Plan.
func (s *Service) Calculate(plate string, violationType string, ts time.Time, rule *rules.RuleVersion) (*Invoice, error) {
	baseAmount, ok := rule.BaseAmounts[violationType]
	if !ok {
		return nil, fmt.Errorf("%w: %q", ErrUnknownViolationType, violationType)
	}

	timeMultiplier := timeMultiplierFor(ts, rule.TimeMultipliers)

	priorCount, err := s.priorUnpaidCount(plate)
	if err != nil {
		return nil, err
	}
	repeatMultiplier := repeatMultiplierFor(priorCount, rule.RepeatMultipliers)

	fineAmount := int(float64(baseAmount)*timeMultiplier*repeatMultiplier + 0.5)

	return &Invoice{
		RuleVersionID:    rule.ID,
		BaseAmount:       baseAmount,
		TimeMultiplier:   timeMultiplier,
		RepeatMultiplier: repeatMultiplier,
		FineAmount:       fineAmount,
		Status:           "pending",
	}, nil
}

// timeMultiplierFor returns the day or night multiplier for the hour of
// ts, handling a night window that wraps past midnight (e.g. 22 -> 6).
func timeMultiplierFor(ts time.Time, tm rules.TimeMultipliers) float64 {
	tsMinutes := ts.Hour()*60 + ts.Minute()
	start, err := tm.NightStartHour.MinutesSinceMidnight()
	if err != nil {
		return tm.Day
	}
	end, err := tm.NightEndHour.MinutesSinceMidnight()
	if err != nil {
		return tm.Day
	}

	var isNight bool
	switch {
	case start == end:
		isNight = false
	case start < end:
		isNight = tsMinutes >= start && tsMinutes < end
	default:
		// Wraps past midnight, e.g. 22 -> 6.
		isNight = tsMinutes >= start || tsMinutes < end
	}

	if isNight {
		return tm.Night
	}
	return tm.Day
}

// priorUnpaidCount counts violations for plate whose invoice is still
// unpaid (pending or failed) and whose timestamp falls within the last
// 90 days. Called before the current violation is inserted, so it
// naturally excludes it.
func (s *Service) priorUnpaidCount(plate string) (int, error) {
	var count int
	err := s.db.QueryRow(`
		SELECT COUNT(*)
		FROM violations v
		JOIN invoices i ON i.violation_id = v.id
		WHERE v.plate = ?
		  AND i.status IN ('pending', 'failed')
		  AND v.timestamp >= datetime('now', '-90 days')
	`, plate).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

// repeatMultiplierFor looks up the multiplier for the given prior-offense
// count. Rule keys are offense counts as strings (e.g. "1", "2"). A count
// of 0 (no priors) always gets multiplier 1.0. If the count exceeds the
// highest configured key, the highest configured multiplier is used, so
// habitual offenders never fall back below the top tier.
func repeatMultiplierFor(count int, table map[string]float64) float64 {
	if count <= 0 || len(table) == 0 {
		return 1.0
	}

	if mult, ok := table[strconv.Itoa(count)]; ok {
		return mult
	}

	maxKey := 0
	maxMult := 1.0
	for k, v := range table {
		n, err := strconv.Atoi(k)
		if err != nil {
			continue
		}
		if n > maxKey {
			maxKey = n
			maxMult = v
		}
	}
	if count > maxKey {
		return maxMult
	}
	return 1.0
}

const invoiceColumns = `id, violation_id, rule_version_id, base_amount, time_multiplier, repeat_multiplier, fine_amount, status, created_at`

// CreateInvoice persists the computed invoice snapshot for violationID.
func (s *Service) CreateInvoice(violationID int, calc *Invoice) (*Invoice, error) {
	res, err := s.db.Exec(
		`INSERT INTO invoices (violation_id, rule_version_id, base_amount, time_multiplier, repeat_multiplier, fine_amount, status)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		violationID, calc.RuleVersionID, calc.BaseAmount, calc.TimeMultiplier, calc.RepeatMultiplier, calc.FineAmount, calc.Status,
	)
	if err != nil {
		return nil, err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	return s.GetInvoice(int(id))
}

// CreateInvoiceTx persists an invoice inside an existing transaction.
func (s *Service) CreateInvoiceTx(tx *sql.Tx, violationID int, calc *Invoice) (*Invoice, error) {
	res, err := tx.Exec(
		`INSERT INTO invoices (violation_id, rule_version_id, base_amount, time_multiplier, repeat_multiplier, fine_amount, status)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		violationID, calc.RuleVersionID, calc.BaseAmount, calc.TimeMultiplier, calc.RepeatMultiplier, calc.FineAmount, calc.Status,
	)
	if err != nil {
		return nil, err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	row := tx.QueryRow(`SELECT `+invoiceColumns+` FROM invoices WHERE id = ?`, id)
	return scanInvoice(row.Scan)
}

// GetInvoice fetches a single invoice by id.
func (s *Service) GetInvoice(id int) (*Invoice, error) {
	row := s.db.QueryRow(`SELECT `+invoiceColumns+` FROM invoices WHERE id = ?`, id)
	return scanInvoice(row.Scan)
}

// GetInvoiceByViolation fetches the invoice for a given violation id.
func (s *Service) GetInvoiceByViolation(violationID int) (*Invoice, error) {
	row := s.db.QueryRow(`SELECT `+invoiceColumns+` FROM invoices WHERE violation_id = ?`, violationID)
	return scanInvoice(row.Scan)
}

func scanInvoice(scan func(dest ...any) error) (*Invoice, error) {
	var inv Invoice
	err := scan(&inv.ID, &inv.ViolationID, &inv.RuleVersionID, &inv.BaseAmount,
		&inv.TimeMultiplier, &inv.RepeatMultiplier, &inv.FineAmount, &inv.Status, &inv.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrInvoiceNotFound
		}
		return nil, err
	}
	return &inv, nil
}

// UpdateInvoiceStatus sets an invoice's status (used by payments after
// a mock charge succeeds or fails).
func (s *Service) UpdateInvoiceStatus(id int, status string) error {
	res, err := s.db.Exec(`UPDATE invoices SET status = ? WHERE id = ?`, status, id)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrInvoiceNotFound
	}
	return nil
}

// GetHistory returns the transaction history for a plate: each
// violation joined with its invoice and the rule version applied,
// most recent first.
func (s *Service) GetHistory(plate string) ([]HistoryRow, error) {
	rows, err := s.db.Query(`
		SELECT v.id, v.plate, v.violation_type, v.location, v.timestamp,
		       i.id, i.fine_amount, i.status, i.rule_version_id, rv.published_at
		FROM violations v
		JOIN invoices i ON i.violation_id = v.id
		JOIN rule_versions rv ON rv.id = i.rule_version_id
		WHERE v.plate = ?
		ORDER BY v.timestamp DESC, v.id DESC
	`, plate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []HistoryRow
	for rows.Next() {
		var h HistoryRow
		if err := rows.Scan(&h.ViolationID, &h.Plate, &h.ViolationType, &h.Location, &h.Timestamp,
			&h.InvoiceID, &h.FineAmount, &h.Status, &h.RuleVersionID, &h.RuleVersionPublished); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}
