-- Parking Violation Portal schema

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER  PRIMARY KEY AUTOINCREMENT,
    email         TEXT     NOT NULL UNIQUE,
    password_hash TEXT     NOT NULL,
    role          TEXT     NOT NULL CHECK (role IN ('officer', 'member')),
    plate         TEXT,
    balance       INTEGER  NOT NULL DEFAULT 0,
    created_at    DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rule_versions (
    id                  INTEGER  PRIMARY KEY AUTOINCREMENT,
    published_by        INTEGER  NOT NULL REFERENCES users(id),
    published_at        DATETIME NOT NULL DEFAULT (datetime('now')),
    is_active           BOOLEAN  NOT NULL DEFAULT 0,
    base_amounts        TEXT     NOT NULL, -- JSON: { "expired_meter": 50000, ... }
    time_multipliers    TEXT     NOT NULL, -- JSON: { "day": 1.0, "night": 1.5, "day_start": "06:00", "day_end": "22:00" }
    repeat_multipliers  TEXT     NOT NULL  -- JSON: { "0": 1.0, "1": 1.5, "2+": 2.0, "window_days": 90 }
);

CREATE TABLE IF NOT EXISTS violations (
    id             INTEGER  PRIMARY KEY AUTOINCREMENT,
    plate          TEXT     NOT NULL,
    violation_type TEXT     NOT NULL,
    location       TEXT     NOT NULL,
    timestamp      DATETIME NOT NULL,
    photo_path     TEXT     NOT NULL,
    submitted_by   INTEGER  NOT NULL REFERENCES users(id),
    created_at     DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
    id                INTEGER  PRIMARY KEY AUTOINCREMENT,
    violation_id      INTEGER  NOT NULL REFERENCES violations(id),
    rule_version_id   INTEGER  NOT NULL REFERENCES rule_versions(id),
    base_amount       INTEGER  NOT NULL,
    time_multiplier   REAL     NOT NULL,
    repeat_multiplier REAL     NOT NULL,
    fine_amount       INTEGER  NOT NULL,
    status            TEXT     NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
    created_at        DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
    id                      INTEGER  PRIMARY KEY AUTOINCREMENT,
    invoice_id              INTEGER  NOT NULL REFERENCES invoices(id),
    member_id               INTEGER  NOT NULL REFERENCES users(id),
    scenario                TEXT     NOT NULL,
    provider_transaction_id TEXT     NOT NULL,
    status                  TEXT     NOT NULL,
    created_at              DATETIME NOT NULL DEFAULT (datetime('now'))
);
