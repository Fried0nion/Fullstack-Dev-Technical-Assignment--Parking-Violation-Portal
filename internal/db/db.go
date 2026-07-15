package db

import (
	"database/sql"
	_ "embed"

	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schema string

// Init opens (or creates) the SQLite database file at path and applies
// the schema using CREATE TABLE IF NOT EXISTS, so it's safe to call on
// every startup.
func Init(path string) (*sql.DB, error) {
	conn, err := sql.Open("sqlite", path+"?_pragma=foreign_keys(1)")
	if err != nil {
		return nil, err
	}

	if err := conn.Ping(); err != nil {
		return nil, err
	}

	if _, err := conn.Exec(schema); err != nil {
		return nil, err
	}

	return conn, nil
}
