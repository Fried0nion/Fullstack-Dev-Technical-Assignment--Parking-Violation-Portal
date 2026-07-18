# Design

This portal is a local-only demo built around a single Go process and a single SQLite file. The backend owns authentication, rule publication, violation ingestion, invoice generation, payment state, and member profile updates. The Next.js frontend is a separate client that talks to the backend over HTTP and stores the JWT locally for route guards.

## ERD
<img width="971" height="1521" alt="ERD (1)" src="https://github.com/user-attachments/assets/dca8bc59-954a-42c2-adc4-17ac5025360f" />



The important boundary is the invoice row. It stores the rule version and the calculated amounts at creation time, so later rule changes never rewrite old fines.

## Data Flow

### Violation Submission → Fine Calculation → Invoice

Every arrow below is a blocking Go function call inside the same OS process. Nothing is asynchronous.
<img width="711" height="490" alt="Diagram 1 — Violation Submission → Fine → Invoice" src="https://github.com/user-attachments/assets/179bab52-4807-4e46-ad72-60a2aaa4bc8d" />


### Payment Processing
<img width="1286" height="1401" alt="Diagram 2 — Payment Processing" src="https://github.com/user-attachments/assets/7bad41de-48ab-4ce9-af4a-bf5ab44b92f5" />

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
