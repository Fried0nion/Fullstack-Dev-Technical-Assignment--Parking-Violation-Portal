"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { getMe, listViolations, getViolation, updatePlate } from "@/lib/api";
import type { User, Violation, Invoice } from "@/lib/types";

function formatIDR(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function MemberDashboardPage() {
  return (
    <ProtectedRoute role="member">
      <Dashboard />
    </ProtectedRoute>
  );
}

interface ViolationWithInvoice {
  violation: Violation;
  invoice?: Invoice;
}

function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<ViolationWithInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // plate edit
  const [editingPlate, setEditingPlate] = useState(false);
  const [newPlate, setNewPlate] = useState("");
  const [plateLoading, setPlateLoading] = useState(false);
  const [plateError, setPlateError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const me = await getMe();
      setUser(me);
      const violations = await listViolations();
      // Fetch invoice for each violation in parallel
      const withInvoices = await Promise.all(
        violations.map(async (v) => {
          try {
            const detail = await getViolation(v.id);
            return { violation: detail.violation, invoice: detail.invoice };
          } catch {
            return { violation: v };
          }
        })
      );
      setRows(withInvoices);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUpdatePlate(e: React.FormEvent) {
    e.preventDefault();
    setPlateError("");
    setPlateLoading(true);
    try {
      const updated = await updatePlate(newPlate);
      setUser(updated);
      setEditingPlate(false);
      // Reload violations — they're filtered by plate server-side
      load();
    } catch (err: unknown) {
      setPlateError(err instanceof Error ? err.message : "Failed to update plate");
    } finally {
      setPlateLoading(false);
    }
  }

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page">
      <h1>My Dashboard</h1>
      {error && <div className="alert alert-error">{error}</div>}

      {/* Profile + balance card */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          <div>
            <p className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Email</p>
            <p>{user?.email}</p>
          </div>
          <div>
            <p className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Balance</p>
            <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--success)" }}>
              {formatIDR(user?.balance ?? 0)}
            </p>
          </div>
          <div>
            <p className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              License Plate
            </p>
            {editingPlate ? (
              <form onSubmit={handleUpdatePlate} style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                <input
                  value={newPlate}
                  onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
                  placeholder="B1234XYZ"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)", padding: "0.35rem 0.6rem", width: 130 }}
                  required
                  autoFocus
                />
                <button type="submit" className="btn btn-primary" style={{ padding: "0.3rem 0.75rem" }} disabled={plateLoading}>
                  Save
                </button>
                <button type="button" className="btn btn-secondary" style={{ padding: "0.3rem 0.75rem" }} onClick={() => { setEditingPlate(false); setPlateError(""); }}>
                  Cancel
                </button>
              </form>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.25rem" }}>
                <p>{user?.plate ?? <span className="muted">—</span>}</p>
                <button
                  className="btn btn-secondary"
                  style={{ padding: "0.2rem 0.6rem", fontSize: "0.8rem" }}
                  onClick={() => { setEditingPlate(true); setNewPlate(user?.plate ?? ""); }}
                >
                  Edit
                </button>
              </div>
            )}
            {plateError && <p className="muted" style={{ color: "var(--danger)", marginTop: "0.25rem" }}>{plateError}</p>}
          </div>
        </div>
      </div>

      {/* Violations */}
      <div className="flex-row" style={{ marginBottom: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>My Violations</h2>
        <span className="spacer" />
        <Link href="/member/payments" className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
          Payment history
        </Link>
      </div>

      {rows.length === 0 && <p className="muted">No violations on record for your plate.</p>}

      {rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Type</th>
                <th>Location</th>
                <th>Date</th>
                <th>Fine</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ violation: v, invoice }) => (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td>{v.violation_type}</td>
                  <td>{v.location}</td>
                  <td>{new Date(v.timestamp).toLocaleDateString()}</td>
                  <td>{invoice ? formatIDR(invoice.fine_amount) : "—"}</td>
                  <td>
                    {invoice ? (
                      <span className={`badge badge-${invoice.status}`}>{invoice.status}</span>
                    ) : "—"}
                  </td>
                  <td>
                    {invoice?.status === "pending" && (
                      <Link
                        href={`/member/pay/${invoice.id}`}
                        className="btn btn-primary"
                        style={{ padding: "0.25rem 0.7rem", fontSize: "0.82rem" }}
                      >
                        Pay
                      </Link>
                    )}
                    {invoice?.status === "failed" && (
                      <Link
                        href={`/member/pay/${invoice.id}`}
                        className="btn btn-danger"
                        style={{ padding: "0.25rem 0.7rem", fontSize: "0.82rem" }}
                      >
                        Retry
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
