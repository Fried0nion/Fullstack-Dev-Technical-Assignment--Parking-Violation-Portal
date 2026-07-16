"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { getBalance, payInvoice } from "@/lib/api";
import type { PayResponse } from "@/lib/types";

function formatIDR(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

interface PageProps {
  params: Promise<{ invoiceId: string }>;
}

export default function PayInvoicePage({ params }: PageProps) {
  return (
    <ProtectedRoute role="member">
      <PayInvoiceInner params={params} />
    </ProtectedRoute>
  );
}

function PayInvoiceInner({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = use(params);
  const router = useRouter();
  const invoiceIdNum = parseInt(invoiceId, 10);

  const [balance, setBalance] = useState<number | null>(null);
  const [scenario, setScenario] = useState<"success" | "failed">("success");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PayResponse | null>(null);

  useEffect(() => {
    getBalance()
      .then((r) => setBalance(r.balance))
      .catch(() => setBalance(null));
  }, []);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await payInvoice(invoiceIdNum, scenario);
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const paid = result.status === "paid";
    return (
      <div className="page">
        <h1>Payment {paid ? "Successful" : "Failed"}</h1>
        <div className={`alert ${paid ? "alert-success" : "alert-error"}`}>
          {paid
            ? `Payment accepted. Transaction ID: ${result.transaction_id}`
            : `Payment failed. Transaction ID: ${result.transaction_id}. Your balance has been refunded.`}
        </div>
        <div className="flex-row" style={{ marginTop: "1.25rem" }}>
          <button className="btn btn-primary" onClick={() => router.push("/member/dashboard")}>
            Back to dashboard
          </button>
          <button className="btn btn-secondary" onClick={() => router.push("/member/payments")}>
            Payment history
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Pay Invoice #{invoiceIdNum}</h1>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ maxWidth: 480 }}>
        {balance !== null && (
          <div style={{ marginBottom: "1.25rem", padding: "0.75rem 1rem", background: "var(--surface2)", borderRadius: 4 }}>
            <span className="muted">Current balance: </span>
            <strong style={{ color: "var(--success)" }}>{formatIDR(balance)}</strong>
          </div>
        )}

        <form onSubmit={handlePay}>
          <div className="field">
            <label>Payment scenario (mock provider)</label>
            <select value={scenario} onChange={(e) => setScenario(e.target.value as "success" | "failed")}>
              <option value="success">Success — payment goes through</option>
              <option value="failed">Failed — provider rejects, balance refunded</option>
            </select>
          </div>

          <p className="muted" style={{ marginBottom: "1rem", fontSize: "0.85rem" }}>
            Your balance will be deducted when you click Pay. If the provider scenario is
            &ldquo;failed&rdquo;, the deduction is rolled back automatically.
          </p>

          <div className="flex-row">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Processing…" : "Pay now"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push("/member/dashboard")}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
