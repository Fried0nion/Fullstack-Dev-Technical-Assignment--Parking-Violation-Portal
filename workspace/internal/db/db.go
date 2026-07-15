package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

// Init opens portal.db and runs schema migrations.
func Init(dbPath string) error {
	var err error
	DB, err = sql.Open("sqlite3", dbPath+"?_foreign_keys=on&_journal_mode=WAL")
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}

	if err = DB.Ping(); err != nil {
		return fmt.Errorf("ping db: %w", err)
	}

	if err = migrate(); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}

	return nil
}

func migrate() error {
	// Locate schema.sql relative to this file's directory at compile time.
	// At runtime we resolve relative to the working directory.
	schemaPath := schemaFilePath()
	data, err := os.ReadFile(schemaPath)
	if err != nil {
		return fmt.Errorf("read schema.sql: %w", err)
	}

	if _, err = DB.Exec(string(data)); err != nil {
		return fmt.Errorf("exec schema: %w", err)
	}

	return nil
}

// schemaFilePath returns the path to schema.sql.
// Tries ./scripts/schema.sql first (runtime working directory),
// then falls back relative to this source file (useful for tests).
func schemaFilePath() string {
	candidate := filepath.Join("scripts", "schema.sql")
	if _, err := os.Stat(candidate); err == nil {
		return candidate
	}
	// Fallback: resolve from source file location
	_, filename, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(filename), "..", "..", "scripts", "schema.sql")
}
