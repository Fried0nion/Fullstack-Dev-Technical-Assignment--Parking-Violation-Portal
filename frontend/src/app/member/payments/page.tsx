"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { listPayments } from "@/lib/api";
import type { Payment } from "@/lib/types";

export default function MemberPaymentsPage() {
  return (
    <ProtectedRoute role="member">
      <PaymentHistory />
    </ProtectedRoute>
  );
}

function PaymentHistory() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listPayments()
      .then(setPayments)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="flex-row" style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ margin: 0 }}>Payment History</h1>
        <span className="spacer" />
        <Link href="/member/dashboard" className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
          ← Dashboard
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="muted">Loading…</p>}

      {!loading && payments.length === 0 && (
        <p className="muted">No payment attempts yet.</p>
      )}

      {payments.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Invoice</th>
                <th>Scenario</th>
                <th>Transaction ID</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>#{p.invoice_id}</td>
                  <td>{p.scenario}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {p.provider_transaction_id || "—"}
                  </td>
                  <td>
                    <span className={`badge badge-${p.status}`}>{p.status}</span>
                  </td>
                  <td>{new Date(p.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
