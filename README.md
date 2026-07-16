# Parking Violation Portal

Local-only demo. Single Go backend (SQLite, no DB server) + Next.js frontend (frontend added in Task 7).



## Prerequisites

- **Go 1.21+** — <https://go.dev/dl/>
- **make**
  * Windows: `choco install make` (via [Chocolatey](https://chocolatey.org/install)), or `winget install GnuWin32.Make`, or install [Git Bash](https://git-scm.com/downloads) / WSL and use its `make`. Every target also has a raw one-line `go`/`sqlite3` equivalent — see "Running without make" below.
  * macOS: already installed (Xcode Command Line Tools), or `brew install make`
  * Linux: `sudo apt install make` (or your distro's equivalent)
- **`sqlite3` CLI** — only used by `make seed` / `make tables` to run raw SQL against `portal.db`; the Go app itself never shells out to it.
  * Windows: `choco install sqlite` or download from <https://sqlite.org/download.html> and put `sqlite3.exe` on your PATH
  * macOS: already installed, or `brew install sqlite`
  * Linux: `sudo apt install sqlite3`

No C compiler / cgo is required — the project uses `modernc.org/sqlite`, a pure-Go SQLite driver, specifically so this runs on a fresh Windows machine without installing MinGW/TDM-GCC.

### Running without make

```
go mod tidy              # instead of: make setup
go run ./cmd             # instead of: make run-backend / make run
sqlite3 portal.db < scripts/seed.sql   # instead of: make seed
sqlite3 portal.db ".tables"            # instead of: make tables
```

## Quickstart

```
make setup     # go mod tidy
make run       # go run ./cmd — creates portal.db, prints "DB ready", starts server on :8080
make tables    # sanity check: lists all 5 tables
make seed      # inserts seeded officer/member + day-one rule
```

## Seed credentials

| Role    | Email                | Password   |
| ------- | --------------------- | ---------- |
| Officer | officer@portal.com    | officer123 |
| Member  | member@portal.com     | member123  |

Member starts with a balance of 2,000,000 (IDR) and plate `B1234XYZ`.

## Notes

- `portal.db` and `uploads/` are gitignored — delete `portal.db` any time to reset local state, then re-run `make run && make seed`.
- All backend routes (auth, rules, violations, users, payments) are wired into `cmd/main.go`.
- The frontend lives in `frontend/`; use `make run-frontend` after `make setup` if you want the Next.js app locally.
- See `DESIGN.md` for the data model, rule-versioning flow, and trade-offs.
- See `TASKS.md` to see this project development step by step.
