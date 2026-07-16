/**
 * Typed wrappers for every backend endpoint.
 * All requests go through /api/* which next.config.ts proxies to
 * http://localhost:8080/* — no CORS issues during local dev.
 *
 * Token management: the token is read from localStorage on every call
 * so it always reflects the latest login state.
 */

import type {
  BalanceResponse,
  Invoice,
  Payment,
  PayResponse,
  RuleVersion,
  SubmitViolationResponse,
  User,
  ViolationDetail,
  Violation,
} from "./types";

const BASE = "/api";

// ── helpers ─────────────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Throws an Error whose message is the backend's `error` field (or HTTP status text). */
async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      // ignore parse errors
    }
    const err = new Error(msg);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

// ── auth ─────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<{ token: string }> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<{ token: string }>(res);
}

// ── users ────────────────────────────────────────────────────────────────────

export async function getMe(): Promise<User> {
  const res = await fetch(`${BASE}/users/me`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<User>(res);
}

export async function updatePlate(plate: string): Promise<User> {
  const res = await fetch(`${BASE}/users/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ plate }),
  });
  return handleResponse<User>(res);
}

export async function getBalance(): Promise<BalanceResponse> {
  const res = await fetch(`${BASE}/users/me/balance`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<BalanceResponse>(res);
}

// ── rules ────────────────────────────────────────────────────────────────────

export async function listRules(): Promise<RuleVersion[]> {
  const res = await fetch(`${BASE}/rules`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<RuleVersion[]>(res);
}

export interface PublishRulePayload {
  base_amounts: Record<string, number>;
  time_multipliers: {
    day: number;
    night: number;
    night_start_hour: number;
    night_end_hour: number;
  };
  repeat_multipliers: Record<string, number>;
}

export async function publishRule(payload: PublishRulePayload): Promise<RuleVersion> {
  const res = await fetch(`${BASE}/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return handleResponse<RuleVersion>(res);
}

// ── violations ───────────────────────────────────────────────────────────────

export async function listViolations(): Promise<Violation[]> {
  const res = await fetch(`${BASE}/violations`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<Violation[]>(res);
}

export async function getViolation(id: number): Promise<ViolationDetail> {
  const res = await fetch(`${BASE}/violations/${id}`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<ViolationDetail>(res);
}

export interface SubmitViolationPayload {
  plate: string;
  violation_type: string;
  location: string;
  timestamp: string; // "YYYY-MM-DDTHH:mm"
  photo?: File | null;
}

export async function submitViolation(
  payload: SubmitViolationPayload
): Promise<SubmitViolationResponse> {
  const form = new FormData();
  form.append("plate", payload.plate);
  form.append("violation_type", payload.violation_type);
  form.append("location", payload.location);
  form.append("timestamp", payload.timestamp);
  if (payload.photo) form.append("photo", payload.photo);

  const res = await fetch(`${BASE}/violations`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: form,
  });
  return handleResponse<SubmitViolationResponse>(res);
}

// ── payments ─────────────────────────────────────────────────────────────────

export async function listPayments(): Promise<Payment[]> {
  const res = await fetch(`${BASE}/payments`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<Payment[]>(res);
}

export async function payInvoice(
  invoiceId: number,
  scenario: "success" | "failed"
): Promise<PayResponse> {
  const res = await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ invoice_id: invoiceId, scenario }),
  });
  return handleResponse<PayResponse>(res);
}

// ── re-export convenience ────────────────────────────────────────────────────

export type { Invoice, Payment, RuleVersion, User, Violation, ViolationDetail };
