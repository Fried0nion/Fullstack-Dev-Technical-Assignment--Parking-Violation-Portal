# Parking Violation Portal

Local-only demo. Single Go backend (SQLite, no DB server) + Next.js frontend (frontend added in Task 7).

## Tasks

- [x] **Task 1 — Project scaffold + SQLite schema**
  Go module scaffold with one internal package per domain (`auth`, `users`, `rules`, `violations`, `fines`, `payments`). `internal/db` opens `portal.db` and applies `schema.sql` (all 5 tables) on every startup via `CREATE TABLE IF NOT EXISTS`. `scripts/gen_hash` prints a bcrypt hash for a given password. `scripts/seed.sql` seeds officer + member accounts and the day-one rule version, passwords already bcrypt-hashed. Makefile: `setup`, `seed`, `run`, etc.

- [x] **Task 2 — `internal/auth`: login + JWT middleware**
  `POST /auth/login` verifies email/password against `users` (bcrypt) and returns a signed JWT (`{sub, role, exp}`, 24h expiry, HS256, hand-rolled with stdlib `crypto/hmac` — no third-party JWT dependency). `auth.Middleware` validates the Bearer token and injects user id + role into the request context; `auth.RequireRole(role)` is the 403 role guard for later officer-only/member-only routes. `cmd/main.go` now runs a real HTTP server on `:8080`.

- [x] **Task 3 — `internal/rules`: rule version management**
  Officers list all rule versions and publish new ones. `rules.Service.GetActive()` is a plain Go function used internally by the violations/fines flow, never exposed over HTTP. Routes: `GET /rules`, `POST /rules` (officer-only, behind JWT + role guard).

- [x] **Task 4 — `internal/violations` + `internal/fines`: violation submission + fine calculation**
  Officer submits a violation (multipart: plate, type, location, timestamp, optional photo); photo saved to `./uploads/{uuid}.{ext}`. Fine calculated synchronously against the active rule version — base amount, day/night time multiplier (handles a night window that wraps past midnight), and a repeat-offense multiplier (based on unpaid violations for the same plate in the last 90 days) — then snapshotted onto an immutable invoice row. Routes: `POST /violations` (officer-only), `GET /violations` (officers see all, members see only their plate), `GET /violations/{id}`.

- [x] **Task 5 — `internal/users`: member profile + balance**
  `GET /users/me`, `PATCH /users/me` (update plate), `GET /users/me/balance`. `users.Service.DeductBalance(userID, amount)` exported for the payments package, returns typed `ErrInsufficientBalance` on failure, uses a race-safe conditional `UPDATE`. `users.Service.RefundBalance(userID, amount)` used by payments to roll back a deduction on provider failure.

- [ ] **Task 6 — `internal/payments`: mocked payment flow**
  `POST /payments` (member-only): validates invoice ownership/status, deducts balance, runs a mocked success/failed charge. Insufficient balance (402) and mock provider failure (invoice → `failed`, balance rolled back) are distinct, explicit outcomes. `GET /payments` lists a member's payment history.

- [ ] **Task 7 — Frontend: Next.js + TypeScript**
  Officer and Member views covering all 5 flows: login, submit violation, publish rules, member dashboard + pay invoice, transaction history. Role-based route guards reading the stored JWT.

- [ ] **Task 8 — Final wiring, Makefile, README, DESIGN.md**
  All routes wired into `cmd/main.go`, full Makefile targets, quickstart README, and `DESIGN.md` covering the ERD, rule-versioning immutability, and documented trade-offs (orphaned photo on DB failure, no refresh tokens, SQLite concurrency limits, etc.).

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

## Try it (Tasks 2 & 3)

```
curl -X POST localhost:8080/auth/login -d '{"email":"officer@portal.com","password":"officer123"}'
```
Returns `{"token": "..."}` — decode the middle (base64url) segment to see `{"sub":1,"role":"officer","exp":...}`.

```
curl -s localhost:8080/rules -H "Authorization: Bearer <officer token>"
```
Returns the seeded day-one rule with `"is_active": true`.

```
curl -s -X POST localhost:8080/rules -H "Authorization: Bearer <officer token>" -d '{
  "base_amounts": {"illegal_parking": 120000},
  "time_multipliers": {"day": 1.0, "night": 1.5, "night_start_hour": 22, "night_end_hour": 6},
  "repeat_multipliers": {"1": 1.5, "2": 2.0}
}'
```
Publishes a new active rule version. Re-run the `GET /rules` above — the new rule is `is_active: true`, the old one flips to `false`. Existing invoices keep their original `rule_version_id` snapshot and are never retroactively changed.

Trying `/rules` with a member token, no token, or a garbage token correctly returns 403 / 401 / 401 respectively.

## Try it (Task 4)

```
curl -X POST localhost:8080/violations -H "Authorization: Bearer <officer token>" \
  -F plate=B1234XYZ -F violation_type=illegal_parking \
  -F location="Jl. Merdeka" -F timestamp=2026-07-15T23:30
```
Returns the created violation + invoice in one response. A night-time timestamp (falls in the 22→6 window) gives `time_multiplier: 1.5`; a daytime one gives `1.0`. The photo field (`-F photo=@/path/to/file.jpg`) is optional.

Submit a second violation for the same plate while the first invoice is still `pending` (unpaid) — the new invoice's `repeat_multiplier` picks up the next tier from the active rule's `repeat_multipliers` (e.g. `1.5` for the 2nd offense).

```
curl -s localhost:8080/violations -H "Authorization: Bearer <officer token>"
```
Officers see every violation; a member token instead only returns violations matching the plate on their profile.

## Notes

- `portal.db` and `uploads/` are gitignored — delete `portal.db` any time to reset local state, then re-run `make run && make seed`.
- Remaining HTTP routes (payments, users) get wired into `cmd/main.go` in later tasks.
