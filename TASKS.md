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

- [x] **Task 6 — `internal/payments`: mocked payment flow**
  `POST /payments` (member-only): validates invoice ownership/status, deducts balance, runs a mocked success/failed charge. Insufficient balance (402) and mock provider failure (invoice → `failed`, balance rolled back) are distinct, explicit outcomes. `GET /payments` lists a member's payment history.

- [x] **Task 7 — Frontend: Next.js + TypeScript**
  Officer and Member views covering all 5 flows: login, submit violation, publish rules, member dashboard + pay invoice, transaction history. Role-based route guards reading the stored JWT.

- [x] **Task 8 — Final wiring, Makefile, README, DESIGN.md**
  All routes wired into `cmd/main.go`, full Makefile targets, quickstart README, and `DESIGN.md` covering the ERD, rule-versioning immutability, and documented trade-offs (orphaned photo on DB failure, no refresh tokens, SQLite concurrency limits, etc.).