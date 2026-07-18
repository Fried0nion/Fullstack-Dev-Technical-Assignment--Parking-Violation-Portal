# Design

This portal is a local-only demo built around a single Go process and a single SQLite file. The backend owns authentication, rule publication, violation ingestion, invoice generation, payment state, and member profile updates. The Next.js frontend is a separate client that talks to the backend over HTTP and stores the JWT locally for route guards.

## Data Model

```mermaid
erDiagram
    USERS ||--o{ RULE_VERSIONS : publishes
    USERS ||--o{ VIOLATIONS : submits
    USERS ||--o{ PAYMENTS : makes
    RULE_VERSIONS ||--o{ INVOICES : snapshots
    VIOLATIONS ||--|| INVOICES : generates
    INVOICES ||--o{ PAYMENTS : records

    USERS {
        int id
        text email
        text password_hash
        text role
        text plate
        int balance
    }

    RULE_VERSIONS {
        int id
        int published_by
        bool is_active
        text base_amounts
        text time_multipliers
        text repeat_multipliers
    }

    VIOLATIONS {
        int id
        text plate
        text violation_type
        text location
        datetime timestamp
        text photo_path
        int submitted_by
    }

    INVOICES {
        int id
        int violation_id
        int rule_version_id
        int base_amount
        float time_multiplier
        float repeat_multiplier
        int fine_amount
        text status
    }

    PAYMENTS {
        int id
        int invoice_id
        int member_id
        text scenario
        text provider_transaction_id
        text status
    }
```

The important boundary is the invoice row. It stores the rule version and the calculated amounts at creation time, so later rule changes never rewrite old fines.

## Data Flow

### Violation Submission → Fine Calculation → Invoice

Every arrow below is a blocking Go function call inside the same OS process. Nothing is asynchronous.

```mermaid
flowchart TD
    A["Officer submits violation\nPOST /violations (multipart)"]
    B["violations.Service.Submit\nSaves photo, orchestrates request"]
    C["rules.Service.GetActive()\nSync call · crosses into rules module"]
    D["fines.Service.Calculate()\nSync call · crosses into fines module"]
    E["Invoice created, response returned\nReturns violation_id, fine_amount, rule_version_id"]

    A --> B
    B --> C
    C --> D
    D --> E
```

### Payment Processing

```mermaid
flowchart TD
    A["Member initiates payment\nPOST /payments {invoice_id, scenario}"]
    B["fines.Service.GetInvoice()\nSync call · crosses into fines module"]
    C{"invoice.Status?"}
    D["Reset to pending\nUPDATE invoices SET status = pending"]
    E["users.Service.DeductBalance()\nSync call · crosses into users module"]
    F{"Sufficient balance?"}
    G["Return 402\nInvoice stays pending, mock never called"]
    H["payments.charge() mock\nIn-process, same module, no network"]
    I{"Charge result?"}
    J["Invoice → paid\nBalance deducted, payment row inserted"]
    K["Balance refunded\nInvoice → failed, payment row inserted"]

    A --> B
    B --> C
    C -- "failed" --> D
    C -- "paid" --> L["Return 409 Conflict"]
    C -- "pending" --> E
    D --> E
    E --> F
    F -- "insufficient" --> G
    F -- "ok" --> H
    H --> I
    I -- "success" --> J
    I -- "failed" --> K
```

Module boundaries are crossed at three points: `violations → rules` (GetActive), `violations → fines` (Calculate), and `payments → fines`/`payments → users` (GetInvoice, DeductBalance). All other calls are within the same package.

## Request Flow

1. The officer logs in and receives a signed JWT containing `sub`, `role`, and `exp`.
2. Auth middleware validates the token and injects the user identity into the request context.
3. Rule publication creates a new active rule version and deactivates the previous one.
4. A violation submission writes the photo, reads the active rule, calculates the fine, and inserts a violation plus a frozen invoice snapshot.
5. Payment attempts deduct balance first, then simulate the provider response. Success marks the invoice paid; failure refunds the balance deduction and marks the invoice failed. A `failed` invoice can be retried: on the next `POST /payments` request, the invoice is silently reset to `pending` before the charge runs, so a new payment attempt and row can be recorded against the same invoice. Only `paid` invoices are permanently closed and return 409.

## Immutability

Rule changes are versioned rather than edited in place. The application reads the active rule for new violations, but existing invoices keep their own `rule_version_id`, base amount, multipliers, and final fine. That keeps historical charges auditable and prevents retroactive price changes.

## Trade-offs

- Uploaded photos are written before the database transaction completes, so a DB failure can leave an orphaned file in `uploads/`.
- JWTs are stateless and there is no refresh-token flow, which keeps the demo simple but makes token revocation coarse-grained.
- SQLite is enough for this assignment, but concurrent write throughput is limited compared with a server database.
- Payment processing is intentionally mocked; the goal is to exercise state transitions and rollback paths, not integrate a real PSP.
- The failed-to-pending reset on retry is non-atomic: a second concurrent request on the same invoice could observe the brief `pending` window between the reset and the charge. This is safe for a local single-user demo but would require a DB-level lock or a dedicated `retrying` status in a production system.