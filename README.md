# Parking Violation Portal

A full-stack demo application for managing parking violations. Built with **Go** (backend), **Next.js** (frontend), and **SQLite** (database). This project demonstrates authentication, rule management, violation submission, fine calculation, and payment processing.

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

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend (3000)                   │
│  (React Components, JWT Storage, Role-Based Routes)         │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTP (REST API)
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  Go Backend (8080)                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Routes (cmd/main.go)                                 │   │
│  │ • /auth/login                                        │   │
│  │ • /rules (officer-only)                             │   │
│  │ • /violations (officer submit, all view)            │   │
│  │ • /users/me (member profile)                        │   │
│  │ • /payments (member-only)                           │   │
│  │ • /uploads/* (file serving)                         │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Services (internal/)                                 │   │
│  │ • auth: JWT signing, validation, middleware         │   │
│  │ • rules: Rule versioning                            │   │
│  │ • violations: Submission + fine calculation         │   │
│  │ • fines: Fine amount logic                          │   │
│  │ • payments: Balance deduction, payment state        │   │
│  │ • users: Member profile, balance management         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────┬───────────────────────────────────────────┘
                  │ SQL
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              SQLite (portal.db)                              │
│  • users • rule_versions • violations • invoices • payments  │
└─────────────────────────────────────────────────────────────┘
```

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

- **Backend Design**: See `DESIGN.md` for data model, request flow, immutability strategy, and detailed trade-offs.
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

**Last updated**: July 17, 2026  
**Version**: 1.0 (as-built)
