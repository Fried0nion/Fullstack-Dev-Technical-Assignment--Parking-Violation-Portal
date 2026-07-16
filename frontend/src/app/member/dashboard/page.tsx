"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { addBalance, getMe, getViolation, listViolations, updatePlate } from "@/lib/api";
import type { Invoice, User, Violation, ViolationDetail } from "@/lib/types";

function formatIDR(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function photoUrl(photoPath?: string | null) {
  if (!photoPath) return null;
  const normalized = photoPath.replace(/^\\+|^\/+/, "");
  const filename = normalized.split(/[\\/]/).pop();
  return filename ? `/uploads/${filename}` : null;
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
  const [selected, setSelected] = useState<ViolationDetail | null>(null);

  const [editingPlate, setEditingPlate] = useState(false);
  const [newPlate, setNewPlate] = useState("");
  const [plateLoading, setPlateLoading] = useState(false);
  const [plateError, setPlateError] = useState("");

  const [addingBalance, setAddingBalance] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const me = await getMe();
      setUser(me);
      const violations = await listViolations();
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

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpdatePlate(e: React.FormEvent) {
    e.preventDefault();
    setPlateError("");
    setPlateLoading(true);
    try {
      const updated = await updatePlate(newPlate);
      setUser(updated);
      setEditingPlate(false);
      load();
    } catch (err: unknown) {
      setPlateError(err instanceof Error ? err.message : "Failed to update plate");
    } finally {
      setPlateLoading(false);
    }
  }

  async function handleAddBalance(e: React.FormEvent) {
    e.preventDefault();
    setBalanceError("");
    setBalanceLoading(true);
    try {
      const updated = await addBalance(Number(balanceAmount));
      setUser((current) => (current ? { ...current, balance: updated.balance } : current));
      setAddingBalance(false);
      setBalanceAmount("");
    } catch (err: unknown) {
      setBalanceError(err instanceof Error ? err.message : "Failed to add balance");
    } finally {
      setBalanceLoading(false);
    }
  }

  async function openDetail(id: number) {
    try {
      const detail = await getViolation(id);
      setSelected(detail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load detail");
    }
  }

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page">
      <h1>My Dashboard</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          <div>
            <p className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Email</p>
            <p>{user?.email}</p>
          </div>
          <div>
            <p className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Balance</p>
            <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--success)" }}>{formatIDR(user?.balance ?? 0)}</p>
            {addingBalance ? (
              <form onSubmit={handleAddBalance} style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                  placeholder="Add amount"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)", padding: "0.35rem 0.6rem", width: 150 }}
                  required
                />
                <button type="submit" className="btn btn-primary" style={{ padding: "0.3rem 0.75rem" }} disabled={balanceLoading}>
                  Add
                </button>
                <button type="button" className="btn btn-secondary" style={{ padding: "0.3rem 0.75rem" }} onClick={() => { setAddingBalance(false); setBalanceError(""); setBalanceAmount(""); }}>
                  Cancel
                </button>
              </form>
            ) : (
              <button type="button" className="btn btn-secondary" style={{ marginTop: "0.5rem" }} onClick={() => setAddingBalance(true)}>
                Add balance
              </button>
            )}
            {balanceError && <p className="muted" style={{ color: "var(--danger)", marginTop: "0.25rem" }}>{balanceError}</p>}
          </div>
          <div>
            <p className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>License Plate</p>
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
                <button className="btn btn-secondary" style={{ padding: "0.2rem 0.6rem", fontSize: "0.8rem" }} onClick={() => { setEditingPlate(true); setNewPlate(user?.plate ?? ""); }}>
                  Edit
                </button>
              </div>
            )}
            {plateError && <p className="muted" style={{ color: "var(--danger)", marginTop: "0.25rem" }}>{plateError}</p>}
          </div>
        </div>
      </div>

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
              {rows.map(({ violation: v, invoice }) => {
                const status = invoice?.status ?? v.invoice_status ?? "pending";
                return (
                  <tr key={v.id}>
                    <td>{v.id}</td>
                    <td>{v.violation_type}</td>
                    <td>{v.location}</td>
                    <td>{new Date(v.timestamp).toLocaleDateString()}</td>
                    <td>{invoice ? formatIDR(invoice.fine_amount) : "—"}</td>
                    <td><span className={`badge badge-${status}`}>{status}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {status === "pending" && invoice && (
                          <Link href={`/member/pay/${invoice.id}`} className="btn btn-primary" style={{ padding: "0.25rem 0.7rem", fontSize: "0.82rem" }}>
                            Pay
                          </Link>
                        )}
                        {status === "failed" && invoice && (
                          <Link href={`/member/pay/${invoice.id}`} className="btn btn-danger" style={{ padding: "0.25rem 0.7rem", fontSize: "0.82rem" }}>
                            Retry
                          </Link>
                        )}
                        <button type="button" className="btn btn-secondary" style={{ padding: "0.25rem 0.7rem", fontSize: "0.82rem" }} onClick={() => openDetail(v.id)}>
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: "1rem",
          }}
          onClick={() => setSelected(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-row" style={{ marginBottom: "1rem" }}>
              <h2 style={{ margin: 0 }}>Violation #{selected.violation.id}</h2>
              <span className="spacer" />
              <button className="btn btn-secondary" style={{ padding: "0.2rem 0.6rem" }} onClick={() => setSelected(null)}>
                ✕
              </button>
            </div>

            <dl style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "0.4rem 1rem", fontSize: "0.9rem" }}>
              <dt className="muted">Plate</dt><dd>{selected.violation.plate}</dd>
              <dt className="muted">Type</dt><dd>{selected.violation.violation_type}</dd>
              <dt className="muted">Location</dt><dd>{selected.violation.location}</dd>
              <dt className="muted">Timestamp</dt><dd>{new Date(selected.violation.timestamp).toLocaleString()}</dd>
              <dt className="muted">Submitted by</dt><dd>User #{selected.violation.submitted_by}</dd>
              <dt className="muted">Status</dt><dd><span className={`badge badge-${selected.invoice?.status ?? selected.violation.invoice_status ?? "pending"}`}>{selected.invoice?.status ?? selected.violation.invoice_status ?? "pending"}</span></dd>
            </dl>

            {photoUrl(selected.violation.photo_path) && (
              <div style={{ marginTop: "1rem" }}>
                <h3 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Photo</h3>
                <img
                  src={photoUrl(selected.violation.photo_path) ?? undefined}
                  alt={`Violation ${selected.violation.id}`}
                  style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)" }}
                />
              </div>
            )}

            {selected.invoice && (
              <>
                <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1rem 0" }} />
                <h2>Invoice #{selected.invoice.id}</h2>
                <dl style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "0.4rem 1rem", fontSize: "0.9rem" }}>
                  <dt className="muted">Base Amount</dt><dd>{formatIDR(selected.invoice.base_amount)}</dd>
                  <dt className="muted">Time ×</dt><dd>{selected.invoice.time_multiplier}</dd>
                  <dt className="muted">Repeat ×</dt><dd>{selected.invoice.repeat_multiplier}</dd>
                  <dt className="muted">Fine Amount</dt><dd><strong>{formatIDR(selected.invoice.fine_amount)}</strong></dd>
                  <dt className="muted">Status</dt><dd><span className={`badge badge-${selected.invoice.status}`}>{selected.invoice.status}</span></dd>
                </dl>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
