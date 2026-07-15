# Parking Violation Portal

Local-only demo. Single Go backend (SQLite, no DB server) + Next.js frontend (frontend added in Task 7).

## Task 1 — what's here

- Go module scaffold with one internal package per domain (`auth`, `users`, `rules`, `violations`, `fines`, `payments`), currently stubs.
- `internal/db`: opens `portal.db` and applies `schema.sql` (all 5 tables) on every startup via `CREATE TABLE IF NOT EXISTS`.
- `scripts/gen_hash`: prints a bcrypt hash for a given password (used to build seed data).
- `scripts/seed.sql`: seeded officer + member accounts and the day-one rule version. Passwords are already bcrypt-hashed.
- `Makefile`: `setup`, `seed`, `run`, etc.

## Prerequisites

- **Go 1.21+** — https://go.dev/dl/
- **make**
  - Windows: easiest is `choco install make` (via [Chocolatey](https://chocolatey.org/install)), or `winget install GnuWin32.Make`, or install [Git Bash](https://git-scm.com/downloads) / WSL and use its `make`. If you'd rather not install `make` at all, every target is a one-line `go` command — see "Running without make" below.
  - macOS: already installed (Xcode Command Line Tools), or `brew install make`
  - Linux: `sudo apt install make` (or your distro's equivalent)
- **`sqlite3` CLI** — only used by `make seed` / `make tables` to run raw SQL against `portal.db`; the Go app itself never shells out to it.
  - Windows: `choco install sqlite` or download from https://sqlite.org/download.html and put `sqlite3.exe` on your PATH
  - macOS: already installed, or `brew install sqlite`
  - Linux: `sudo apt install sqlite3`

No C compiler / cgo is required — the project uses `modernc.org/sqlite`, a pure-Go SQLite driver, specifically so this runs on a fresh Windows machine without installing MinGW/TDM-GCC.

### Running without make

If you don't want to install `make`, run the equivalent commands directly:

```bash
go mod tidy              # instead of: make setup
go run ./cmd             # instead of: make run-backend / make run
sqlite3 portal.db < scripts/seed.sql   # instead of: make seed
sqlite3 portal.db ".tables"            # instead of: make tables
```

## Quickstart

```bash
make setup     # go mod tidy
make run       # go run ./cmd — creates portal.db and prints "DB ready"
make tables    # sanity check: lists all 5 tables
make seed      # inserts seeded officer/member + day-one rule
```

## Seed credentials

| Role    | Email               | Password    |
|---------|---------------------|-------------|
| Officer | officer@portal.com  | officer123  |
| Member  | member@portal.com   | member123   |

Member starts with a balance of 2,000,000 (IDR) and plate `B1234XYZ`.

## Notes

- `portal.db` and `uploads/` are gitignored — delete `portal.db` any time to reset local state, then re-run `make run && make seed`.
- Later tasks wire up HTTP routes for auth, rules, violations, fines, and payments into `cmd/main.go`.
