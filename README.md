# Parking Violation Portal

A full-stack demo application for managing parking violations, created as fast and simple as i can manage. Built with **Go** (backend), **Next.js** (frontend), and **SQLite** (database). This project demonstrates authentication, rule management, violation submission, fine calculation, and payment processing.

**Status:** Local-only demo (single Go process, SQLite file-based database, no external services)

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Installation & Setup](#installation--setup)
- [Development](#development)
- [API Reference](#api-reference)
- [User Workflows](#user-workflows)
- [Database & Schema](#database--schema)
- [Troubleshooting](#troubleshooting)
- [Architecture & Design](#architecture--design)
- [Assumptions](#assumptions)
- [Why It's Designed This Way](#why-its-designed-this-way)
- [Trade-offs](#trade-offs)
- [What I Would Do With More Time](#what-i-would-do-with-more-time)

---

## Overview

### What This Project Does

The Parking Violation Portal is a system for managing parking violations in a parking authority. It supports two main user roles:

- **Officers**: Submit violations, manage parking rules
- **Members**: View their violations, pay fines

### Key Features

✅ **User Authentication** — JWT-based login with role-based access control  
✅ **Rule Management** — Officers publish versioned parking rules  
✅ **Violation Submission** — Officers record violations with photos  
✅ **Fine Calculation** — Dynamic fine amounts based on rule versions, time of day, and repeat offenses  
✅ **Payment Processing** — Members pay fines (mocked provider)  
✅ **Immutable Invoices** — Rule changes don't affect old fines  
✅ **Photo Storage** — Violations include uploaded images  
✅ **Member Dashboard** — View profile, violations, balance, and payment history  

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Go 1.21+ |
| **Frontend** | Next.js 15, React 19, TypeScript |
| **Database** | SQLite (file-based, pure-Go driver) |
| **Auth** | JWT (HS256, hand-rolled) |
| **Photo Storage** | Local filesystem (`./uploads/`) |

---

## Prerequisites

### Required

- **Go 1.21+**  
  Download: https://go.dev/dl/

- **Node.js 18+ & npm**  
  Download: https://nodejs.org/

- **make**  
  Installation depends on your OS:
  
  - **Windows**:  
    - Option 1 (Chocolatey): `choco install make`  
    - Option 2 (winget): `winget install GnuWin32.Make`  
    - Option 3: Install [Git Bash](https://git-scm.com/downloads) or [WSL](https://learn.microsoft.com/en-us/windows/wsl/)
  
  - **macOS**:  
    - Pre-installed (with Xcode Command Line Tools), or `brew install make`
  
  - **Linux**:  
    - `sudo apt install make` (Debian/Ubuntu) or your distro's equivalent

### Optional (for database inspection)

- **sqlite3 CLI**  
  - Windows: `choco install sqlite` or download from https://sqlite.org/download.html
  - macOS: `brew install sqlite`
  - Linux: `sudo apt install sqlite3`

### No Additional Setup Required

- ✅ No C compiler / cgo needed — project uses `modernc.org/sqlite` (pure-Go driver)
- ✅ No database server — SQLite is file-based
- ✅ No external services — all payment processing is mocked locally

---

## Quick Start

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone <repo-url>
cd Fullstack-Dev-Technical-Assignment--Parking-Violation-Portal

# Install Go modules and frontend dependencies
make setup
```

### 2. Start the Backend

```bash
make run
```

Expected output:
```
DB ready
listening on :8080
```

The backend is now running at **http://localhost:8080**

### 3. Seed Initial Data

In a **new terminal**, choose one of the following options:

**Option A: Using Make** (recommended)
```bash
make seed
```

**Option B: Using Go directly**
```bash
go run ./scripts/seed
```

**Option C: Using pre-compiled binary** (if available, haven't tested)
```bash
./seed.exe
```

Any of these creates:
- One officer account
- One member account
- A sample parking rule

### 4. Start the Frontend

In a **new terminal**, run:

```bash
make run-frontend
```

The frontend will be available at **http://localhost:3000**

### 5. Login & Explore

Use these credentials to login:

| Role    | Email               | Password   |
|---------|---------------------|------------|
| Officer | officer@portal.com  | officer123 |
| Member  | member@portal.com   | member123  |

**Member details:**
- Starting balance: 2,000,000 IDR
- Vehicle plate: B1234XYZ

---

## Installation & Setup

### Full Installation Steps

#### Step 1: Clone Repository

```bash
git clone <repo-url>
cd Fullstack-Dev-Technical-Assignment--Parking-Violation-Portal
```

#### Step 2: Verify Prerequisites

Check Go version:
```bash
go version    # Should be 1.21 or higher
```

Check Node version:
```bash
node --version    # Should be 18+
npm --version     # Should be 9+
```

Check make:
```bash
make --version
```

#### Step 3: Install Dependencies

```bash
make setup
```

This runs:
- `go mod tidy` — downloads Go dependencies
- `cd frontend && npm ci` — installs exact Node dependencies

#### Step 4: Verify Installation

Check all tables are created:
```bash
make tables
```

Expected output:
```
users|rule_versions|violations|invoices|payments
```

### Running Without Make

If `make` is not available, use these commands directly:

```bash
# Setup
go mod tidy
cd frontend && npm ci

# Run backend
go run ./cmd

# Run frontend (from frontend/ directory)
npm run dev

# Seed data - choose one option:
go run ./scripts/seed    # Using Go
./seed.exe               # Using pre-compiled binary (if available)

# Check tables
sqlite3 portal.db ".tables"
```

**Note**: The `seed.exe` binary is a pre-compiled version of the seeder. If it doesn't exist, use `go run ./scripts/seed` instead. To create the binary for future use:
```bash
go build ./scripts/seed -o seed.exe
```

---

## Development

### Available Makefile Commands

```bash
make setup              # Install dependencies
make run                # Start backend on :8080
make run-backend        # Same as 'make run'
make run-frontend       # Start frontend dev server on :3000
make seed               # Seed database with initial data
make tables             # List all database tables
make build-frontend     # Production build of frontend
make lint-frontend      # Run ESLint on frontend code
make frontend-install   # Reinstall frontend dependencies
```

### Common Development Tasks

#### Reset Database to Fresh State

```bash
# Delete the database file (gitignored)
rm portal.db

# Restart backend (creates fresh DB)
make run

# In another terminal, re-seed
make seed
```

#### View Database Contents

```bash
sqlite3 portal.db
```

Then try queries like:
```sql
-- List all users
SELECT id, email, role, balance FROM users;

-- View violations
SELECT id, plate, violation_type, location FROM violations;

-- Check payment status
SELECT id, status, created_at FROM payments;

-- Exit
.quit
```

#### Check Frontend Build

```bash
make build-frontend
```

#### Lint Frontend Code

```bash
make lint-frontend
```

---

## API Reference

### Authentication

#### `POST /auth/login`

Login with email and password. Returns a JWT token valid for 24 hours.

**Request:**
```json
{
  "email": "officer@portal.com",
  "password": "officer123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400` — Missing email or password
- `401` — Invalid credentials

**Usage:**
Include the token in all subsequent requests:
```
Authorization: Bearer <token>
```

---

### Rules (Officer-Only)

#### `GET /rules`

List all rule versions (active and inactive).

**Response (200):**
```json
[
  {
    "id": 1,
    "is_active": true,
    "base_amounts": { "speeding": 500000, "illegal_parking": 300000 },
    "time_multipliers": { "day": 1.0, "night": 1.5 },
    "repeat_multipliers": { "0": 1.0, "1": 1.5, "2": 2.0 }
  }
]
```

#### `POST /rules`

Publish a new parking rule (deactivates the previous rule).

**Request:**
```json
{
  "base_amounts": { "speeding": 500000, "illegal_parking": 300000 },
  "time_multipliers": { "day": 1.0, "night": 1.5 },
  "repeat_multipliers": { "0": 1.0, "1": 1.5, "2": 2.0 }
}
```

**Response (201):**
```json
{
  "id": 2,
  "is_active": true,
  "published_at": "2026-07-17T10:30:00Z"
}
```

---

### Violations (Officer: Submit, All Users: View)

#### `POST /violations`

Submit a new violation (officer-only). Includes optional photo upload.

**Request (multipart/form-data):**
```
plate: B1234XYZ
violation_type: illegal_parking
location: Main Street, Downtown
timestamp: 2026-07-17T14:30:00Z
photo: [binary file]
```

**Response (201):**
```json
{
  "id": 1,
  "plate": "B1234XYZ",
  "violation_type": "illegal_parking",
  "location": "Main Street, Downtown",
  "photo_path": "/uploads/550e8400-e29b-41d4-a716-446655440000.jpg",
  "invoice": {
    "id": 1,
    "fine_amount": 450000,
    "status": "pending"
  }
}
```

#### `GET /violations`

List violations.

- **Officers**: See all violations
- **Members**: See only violations for their registered plate

**Response (200):**
```json
[
  {
    "id": 1,
    "plate": "B1234XYZ",
    "violation_type": "illegal_parking",
    "location": "Main Street, Downtown",
    "timestamp": "2026-07-17T14:30:00Z",
    "photo_path": "/uploads/550e8400-e29b-41d4-a716-446655440000.jpg",
    "invoice": {
      "id": 1,
      "fine_amount": 450000,
      "status": "pending"
    }
  }
]
```

#### `GET /violations/{id}`

Get details of a specific violation.

**Response (200):** Same as violation object in list

---

### Users (Member Profile)

#### `GET /users/me`

Get current user profile.

**Response (200):**
```json
{
  "id": 2,
  "email": "member@portal.com",
  "role": "member",
  "plate": "B1234XYZ",
  "balance": 1500000
}
```

#### `PATCH /users/me`

Update user profile (e.g., change plate).

**Request:**
```json
{
  "plate": "B5678ABC"
}
```

**Response (200):** Updated user object

#### `GET /users/me/balance`

Get current balance.

**Response (200):**
```json
{
  "balance": 1500000
}
```

---

### Payments (Member-Only)

#### `POST /payments`

Attempt to pay an invoice.

**Request:**
```json
{
  "invoice_id": 1
}
```

**Response (200):**
```json
{
  "id": 1,
  "invoice_id": 1,
  "status": "paid",
  "provider_transaction_id": "txn_123456789"
}
```

**Error Responses:**
- `402` — Insufficient balance
- `400` — Invoice not found or already paid
- `500` — Payment provider error (simulated)

#### `GET /payments`

List all payments for the current member.

**Response (200):**
```json
[
  {
    "id": 1,
    "invoice_id": 1,
    "status": "paid",
    "created_at": "2026-07-17T15:00:00Z"
  }
]
```

---

### File Uploads

#### `GET /uploads/{filename}`

Download a violation photo. Files are served from `./uploads/`.

**Example:**
```
GET /uploads/550e8400-e29b-41d4-a716-446655440000.jpg
```

---

## User Workflows

### Officer Workflow

1. **Login**
   - Navigate to http://localhost:3000/login
   - Enter `officer@portal.com` / `officer123`
   - JWT token stored in localStorage

2. **Publish Rules** (optional)
   - Go to Officer → Rules
   - Create new rule with base amounts, time multipliers, and repeat multipliers
   - Previous rule is automatically deactivated

3. **Submit Violations**
   - Go to Officer → New Violation
   - Enter: plate, violation type, location, timestamp
   - Upload violation photo (optional)
   - System calculates fine based on active rule:
     - **Base amount** for violation type
     - **Time multiplier** (day vs. night)
     - **Repeat multiplier** (if same plate has unpaid violations in last 90 days)
   - Invoice created with frozen amounts

4. **View All Violations**
   - Go to Officer → Violations
   - See all violations in the system
   - Click violation to see details and photo

### Member Workflow

1. **Login**
   - Navigate to http://localhost:3000/login
   - Enter `member@portal.com` / `member123`
   - JWT token stored in localStorage

2. **View Dashboard**
   - See profile: balance, plate
   - See violations for your plate only
   - See payment history

3. **View Violations**
   - Go to Member → Violations
   - See only violations for your registered plate
   - See fine amounts and invoice status

4. **Pay Fine**
   - Go to Member → Payments
   - See pending invoices and their fine amounts
   - Click "Pay" to deduct balance and pay invoice
   - Payment may succeed or fail (mocked):
     - **Success**: Invoice marked paid, balance deducted
     - **Failure**: Balance restored, invoice marked failed

5. **Check Balance**
   - Go to Member → Dashboard
   - Current balance shown (starting: 2,000,000 IDR)
   - Balance updates after each payment

---

## Database & Schema

### Tables Overview

| Table | Purpose |
|-------|---------|
| `users` | Officer and member accounts, balance, plate |
| `rule_versions` | Versioned parking rules (officer-published) |
| `violations` | Recorded violations with photos |
| `invoices` | Fine amounts calculated and frozen at violation time |
| `payments` | Payment attempts and outcomes |

### Schema Details

See `internal/db/schema.sql` for complete schema. Key points:

- **Immutability**: Invoices store a copy of `rule_version_id`, `base_amount`, `time_multiplier`, `repeat_multiplier`, and calculated `fine_amount`. Rule changes don't affect old fines.

- **Indexes**: Queries on `plate`, `violation_id`, and `invoice_id` are indexed for performance.

- **Constraints**: Role must be `'officer'` or `'member'`. Payment and invoice statuses are enum-like (CHECK constraints).

### Sample Query

View a member's unpaid violations:
```sql
SELECT v.id, v.plate, v.violation_type, i.fine_amount, i.status
FROM violations v
JOIN invoices i ON v.id = i.violation_id
WHERE v.plate = 'B1234XYZ' AND i.status = 'pending';
```

---

## Troubleshooting

### "command not found: make"

**Solution**: See [Prerequisites → make](#optional-for-database-inspection) for installation instructions.

### "go: command not found"

**Solution**: Install Go from https://go.dev/dl/. Add Go to your PATH if needed.

### "npm: command not found"

**Solution**: Install Node.js from https://nodejs.org/. npm is bundled with Node.

### Backend won't start: "address already in use"

**Cause**: Port 8080 is already in use.

**Solution**:
- Restart: Kill the process using port 8080
  - Windows: `netstat -ano | findstr :8080` then `taskkill /PID <PID>`
  - macOS/Linux: `lsof -i :8080` then `kill -9 <PID>`
- Verify: `make run` should show "listening on :8080"

### Frontend won't start: "Port 3000 already in use"

**Cause**: Another Next.js dev server is running.

**Solution**: Kill the process using port 3000, then `make run-frontend`

### Database file corrupted

**Cause**: Crash during write operation

**Solution**: Delete and recreate:
```bash
rm portal.db
make run
make seed
```

### "DB ready" but backend crashes immediately after

**Cause**: Schema creation failed

**Solution**: Check `internal/db/schema.sql` is valid SQL. Run `make seed` to verify DB.

### Frontend login fails with "401 Unauthorized"

**Cause**: Invalid credentials or backend not running

**Checks**:
1. Verify backend is running: `curl http://localhost:8080/auth/login`
2. Verify credentials: Officer = `officer@portal.com` / `officer123`, Member = `member@portal.com` / `member123`
3. Re-seed if needed: `make seed`

### Photos not uploading in violation form

**Cause**: `./uploads/` directory missing or no write permissions

**Solution**: Create directory:
```bash
mkdir uploads
```

On Windows with restricted permissions, run CMD as Administrator.

### JWT expired / token rejected

**Cause**: Token is valid for 24 hours only

**Solution**: Login again. Token will be refreshed.

### "Insufficient balance" error when paying

**Cause**: Member's balance is less than invoice fine amount

**Solution**: 
- Check balance: `GET /users/me/balance`
- Starting balance: 2,000,000 IDR
- If balance is low, reset database: `rm portal.db && make run && make seed`

---

## Architecture & Design

### High-Level Architecture

<img width="1995" height="1242" alt="High-Level Architecture" src="https://github.com/user-attachments/assets/e58879cf-6f43-4ef1-9f49-0a52cbd0e3e0" />


### Key Design Principles

1. **Immutable Invoices**: Fine amounts are calculated and frozen when a violation is recorded. Rule changes don't affect old invoices.

2. **Role-Based Access Control**: JWT contains user ID and role. Middleware validates and injects into request context.

3. **Versioned Rules**: Instead of editing rules in-place, officers publish new versions. The active rule is read for new violations.

4. **Mocked Payment Processing**: Payment success/failure is simulated. A real implementation would integrate a payment service provider (PSP).

5. **Stateless Auth**: JWTs are self-contained; no server-side session storage. Tokens expire after 24 hours.

### Fine Calculation

When an officer submits a violation, the system calculates the fine:

```
Fine = BaseAmount × TimeMultiplier × RepeatMultiplier
```

- **BaseAmount**: Defined in the active rule for the violation type
- **TimeMultiplier**: 1.0 (day, 6 AM–9 PM) or 1.5 (night, 9 PM–6 AM)
- **RepeatMultiplier**: 1.0 (first offense), 1.5 (1 unpaid violation in 90 days), 2.0 (2+ unpaid violations)

### File Structure

```
.
├── cmd/
│   └── main.go                    # HTTP server setup, route wiring
├── frontend/
│   ├── src/
│   │   ├── app/                   # Next.js pages (login, dashboard, etc.)
│   │   ├── components/            # React components (nav, protected routes)
│   │   ├── context/               # Auth context (JWT management)
│   │   └── lib/                   # Utilities (API client, auth helpers)
│   ├── package.json               # Frontend dependencies
│   └── tsconfig.json              # TypeScript config
├── internal/
│   ├── auth/                      # JWT signing, validation, middleware
│   ├── db/                        # SQLite setup, schema
│   ├── fines/                     # Fine calculation logic
│   ├── payments/                  # Payment processing
│   ├── rules/                     # Rule management, versioning
│   ├── users/                     # User profiles, balance management
│   └── violations/                # Violation submission, photo upload
├── scripts/
│   └── seed.go                    # Initial data seeding
├── uploads/                       # Photo storage (gitignored)
├── DESIGN.md                      # Architecture & trade-offs
├── TASKS.md                       # Development history
├── Makefile                       # Build & run commands
└── README.md                      # This file
```

### Security Considerations

- **Password Hashing**: Uses `golang.org/x/crypto/bcrypt` (10 rounds)
- **JWT Signature**: HMAC-SHA256 with environment-configurable secret (`JWT_SECRET` env var, defaults to `"dev-secret"`)
- **Role Guards**: Auth middleware enforces officer-only and member-only endpoints
- **Plate Scoping**: Members can only see violations for their registered plate

### Known Trade-offs & Limitations

For a full list of trade-offs, see `DESIGN.md`. Key points:

1. **Photo Orphaning**: If the database transaction fails after photo upload, the file may remain in `./uploads/`.
2. **No Token Refresh**: JWT expires after 24 hours; users must login again.
3. **SQLite Concurrency**: Limited write throughput compared to server databases.
4. **Mocked Payments**: Payment provider is simulated; a real system would use an actual PSP (Stripe, PayPal, etc.).
5. **No Payment Webhooks**: Payment status is not updated via webhook; it's determined by the synchronous payment attempt.

---

## Additional Resources

- **Development History**: See `TASKS.md` for the step-by-step development process.
- **Go Modules**: `go.mod` lists dependencies (modernc.org/sqlite, golang.org/x/crypto).
- **Frontend Code**: TypeScript + React in `frontend/src/` with Next.js 15.

---

## Getting Help

### Common Issues

Refer to the [Troubleshooting](#troubleshooting) section above.

### Resetting to a Clean State

```bash
# Stop all running processes (Ctrl+C in terminals)

# Delete database and uploads
rm portal.db
rm -r uploads

# Reinstall dependencies
make setup

# Start fresh
make run          # Terminal 1: Backend
make seed         # Terminal 2: Seed data
make run-frontend # Terminal 3: Frontend
```

### Reviewing Logs

Backend logs print to stdout. Frontend dev server logs also print to stdout.

For database queries, use:
```bash
sqlite3 portal.db
```

---

## Assumptions

- **Single reviewer/demo user at a time.** No concurrent load, no multi-tenant setup, no need for horizontal scaling.
- **Trusted network.** The app runs on `localhost` only; there's no HTTPS, no CORS hardening, no rate limiting, no CSRF protection.
- **Two fixed roles.** Only "officer" and "member" exist — no admin tier, no multi-officer permission levels, no ability to register new accounts through the UI (seeded via `seed.sql` only).
- **One active rule version at a time.** Fine calculation always reads a single `is_active = 1` row; there is no scheduling of "this rule becomes active on date X."
- **Currency is IDR, but stored as integers.** All amounts are stored as whole integers (no decimals/cents handling), since IDR has no subunit in common use.
- **Photo upload is "best effort."** A violation photo is expected but not deeply validated (no virus scanning, no file-type allowlist beyond basic extension check, no image resizing/compression).
- **Payment is fully mocked.** There is no real payment gateway; `scenario: success | failed` is chosen by the user in the UI to simulate both paths. No webhook, no idempotency key from an external provider.
- **Clock trust.** Timestamps (violation time, "night" window, 90-day repeat-offender lookback) trust the server's local clock; there's no timezone normalization beyond what SQLite/Go provide by default.
- **No horizontal file storage.** Photos live at `./uploads/` on disk, assumed to be the same machine the Go process runs on.

---

## Why It's Designed This Way

### Single Go binary, internal packages per domain
A single process with `internal/auth`, `internal/users`, `internal/rules`, `internal/violations`, `internal/fines`, `internal/payments` was chosen over microservices because:
- The assignment is a demo, not a distributed system — one binary is faster to build, run, and reason about.
- Domain boundaries are still enforced at the *code* level (Go's `internal/` visibility rules prevent cross-package reach-around), which demonstrates separation of concerns without the operational overhead of network calls between services.
- Every cross-domain call (e.g. `violations` → `rules.GetActive()` → `fines.Calculate()`) is a plain Go function call, not an HTTP round-trip — so it's synchronous, transaction-friendly, and trivial to debug with a single stack trace.

### SQLite instead of Postgres/MySQL
- No DB server to install, configure, or tear down — matches the "runs locally, not deployed" requirement exactly.
- `modernc.org/sqlite` (pure-Go driver) was used instead of `mattn/go-sqlite3` (cgo-based) specifically so the project builds on a fresh Windows machine **without** installing a C compiler (MinGW/TDM-GCC).
- Schema is applied via `CREATE TABLE IF NOT EXISTS` on every startup instead of a formal migration tool (e.g. `golang-migrate`) — appropriate for a single-developer, single-environment demo; would not scale to a team with evolving schemas in production.

### Rule versioning with immutable snapshots
- Every invoice stores its own copy of `rule_version_id`, `base_amount`, `time_multiplier`, and `repeat_multiplier` at creation time, rather than joining live against the current active rule.
- **Why:** if a rule is republished later, historical invoices must still reflect the rule that was active when the violation happened. This mirrors real-world regulatory/audit requirements (you can't retroactively change someone's fine because the city changed its fee schedule).
- **Trade-off:** `rule_versions` rows are effectively append-only — publishing always inserts a new row and flips the old one's `is_active` to false.

### JWT with 24h expiry, no refresh tokens
- Simplifies the demo considerably: no refresh-token rotation, no token revocation list, no logout-everywhere flow.
- **Trade-off:** a stolen token is valid for up to 24 hours with no way to revoke it early. Acceptable for a local demo; not acceptable for production.

### Balance deduction ordering (deduct before mock charge)
- `users.Service.DeductBalance` is called **before** `charge()` so that insufficient balance (`402`) is distinguishable from a mock provider failure (`failed` status), even though both ultimately mean "no money moved."
- If the mock charge later reports `"failed"`, the balance deduction is rolled back — this models the real-world "authorize then confirm/void" pattern without needing a real payment processor.

### Repeat-offender multiplier definition
- "Unpaid" is defined as `status IN ('pending', 'failed')` within the last 90 days, explicitly **not** just `'pending'`. A failed payment attempt doesn't erase the violation — the plate is still a repeat offender until it's actually paid.

### No automated tests
- Manual curl/Postman verification per flow was chosen to keep the timeline focused on breadth across all 5 flows rather than test infrastructure.
- **Trade-off:** no regression safety net; any future change requires re-walking all 5 flows by hand.

---

## Trade-offs

| Area | Trade-off | Why acceptable for this demo |
|---|---|---|
| **Photo storage** | Saved to local disk `./uploads/`; if the DB insert fails after the file write, the photo is orphaned (never cleaned up) | No production traffic, no cost to leftover files, simpler code than a two-phase commit or cleanup job |
| **Auth** | No refresh tokens, no revocation, 24h flat expiry | Local-only, single-session demo; revocation infra is unnecessary complexity |
| **Concurrency** | SQLite is not built for high-concurrency production writes | Only one or two people using the app at once during a demo/review |
| **Payments** | Fully mocked — no real gateway, no webhooks, no idempotency keys from a provider | The assignment explicitly calls for a mocked payment with a scenario selector, not real money movement |
| **Validation** | Minimal input validation (e.g. photo file type, plate format) | Focus is on demonstrating the end-to-end flow, not hardening every input boundary |
| **Schema migrations** | `CREATE TABLE IF NOT EXISTS` on every boot instead of versioned migrations | Single environment, single developer — no need to coordinate schema changes across people/environments |
| **Security headers / CORS / HTTPS** | None configured | `localhost`-only, not deployed, not exposed to the internet |
| **Error handling depth** | Orphaned files and some edge cases are documented rather than defensively coded around | Time-boxed assignment; documenting a trade-off is treated as equally valid to eliminating it |
| **Frontend state** | Token stored in `localStorage`, no CSRF protection, no session cookies | Simplifies the demo frontend; would need to change for any real deployment |
| **Timezones** | Relies on server-local time for "night" window and 90-day lookback | Single-machine demo; no multi-region users to account for |
| **No register** | only two fixed roles for demonstration, therefore there's no need for registering and adding new accounts.   |

---

## What I Would Do With More Time

The list below is roughly in the order I'd tackle it, earliest items are most top priority.

### 4.1 Database: SQLite → Postgres
- **What:** Move `portal.db` to a Postgres instance (Docker Compose locally, managed RDS/Cloud SQL in prod), introduce a real migration tool (`golang-migrate` or `atlas`) instead of `CREATE TABLE IF NOT EXISTS` on boot.
- **Why now instead of later:** SQLite's single-writer lock means any two people using the app at once (an officer submitting a violation while a member pays) risk `database is locked` errors. This is the first thing that breaks under real usage.
- **Also would add:** connection pooling (`pgxpool`), explicit transaction boundaries around the rule-publish flow and payment flow.

### 4.2 Auth: sessions that can actually be revoked
- **What:** Add a refresh-token flow (short-lived access token ~15 min + longer-lived refresh token stored server-side in a `sessions` table), move the JWT out of `localStorage` into an `httpOnly`, `Secure`, `SameSite=Strict` cookie.
- **Why:** right now a leaked token is valid for a full 24 hours with zero way to kill it. I'd add a `POST /auth/logout` that actually invalidates server-side state, plus a "sign out of all devices" action for officers.
- **Also would add:** password reset flow, account lockout after N failed logins, and moving `JWT_SECRET` out of the env-var default (`"dev-secret"`) into a proper secrets manager.

### 4.3 Payments: real gateway integration
- **What:** Swap the in-memory `charge()` mock for a real provider — Midtrans or Xendit, since this targets IDR (both have solid Go SDKs and sandbox modes).
- **Why:** the mock hardcodes the outcome via a `scenario` field the client controls. A real integration means handling asynchronous webhooks, so I'd need to:
  - Add a `pending_confirmation` invoice status between `pending` and `paid`/`failed`.
  - Add webhook signature verification.
  - Add idempotency keys so a retried webhook doesn't double-charge a balance.
  - Add a reconciliation job that polls the provider for any payment whose webhook never arrived.

### 4.4 File uploads: stop trusting local disk
- **What:** Move photo storage from `./uploads/` to object storage (S3-compatible — S3 itself or MinIO for self-hosted), store only the object key in `violations.photo_path`.
- **Why:** local disk doesn't survive a redeploy, doesn't scale past one machine, and the current "orphaned file on DB failure" trade-off is only acceptable because nothing depends on cleanup today. With more time I'd:
  - Validate actual file content (magic-byte check, not just extension) and cap file size.
  - Generate a pre-signed upload URL from the backend so large photos don't have to be proxied through the Go process.
  - Add a scheduled job that diffs "files in storage" against "photo_path values in the DB" and deletes true orphans.

### 4.5 Testing
- **What:** Start with the highest-value, lowest-effort tests first — `fines.Calculate` is pure logic (no I/O) and is exactly the kind of function that silently breaks when someone tweaks a multiplier, so it'd get unit tests before anything else. Next would be an integration test for the full payment flow (insufficient balance → 402, success → paid + balance reduced, failure → rollback), since that flow has the most branching and the most money-related risk.
- **Why last on the initial list despite being "first" in good practice:** for a time-boxed demo, breadth across all 5 flows mattered more than test coverage on any one of them — but this would be the very first thing added in week two of a real project.

### 4.6 Network hardening
- **What:** CORS allow-list (currently wide open since everything is `localhost`), HTTPS via a reverse proxy (Caddy/nginx) or a managed load balancer, rate limiting on `/auth/login` specifically (currently has zero brute-force protection) and more lightly on the rest of the API.
- **Why:** none of this matters until the API is reachable from anywhere other than the same machine — but it's the last thing I'd do before any real exposure.

### 4.7 Observability
- **What:** Structured logging (currently ad-hoc `log.Println` calls), request IDs threaded through context, and basic metrics (request latency, payment success/failure rate) if this were ever handling real transactions.
- **Why later:** invisible to a local demo reviewer, but the first thing I'd wish I had the moment this ran unattended for real users.

### 4.8 Implementing registration feature
- **What:** Adding new page and program to add new users with roles
- **Why later:** To make sure the base app for demonstration is working perfectly before adding new users.
---

**Last updated**: July 18, 2026  
**Version**: 1.0 (as-built)
