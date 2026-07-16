"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { listViolations, getViolation } from "@/lib/api";
import type { Violation, ViolationDetail } from "@/lib/types";

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

export default function OfficerViolationsPage() {
  return (
    <ProtectedRoute role="officer">
      <ViolationsList />
    </ProtectedRoute>
  );
}

function ViolationsList() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ViolationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    listViolations()
      .then(setViolations)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function openDetail(id: number) {
    setDetailLoading(true);
    try {
      const detail = await getViolation(id);
      setSelected(detail);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to load detail");
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="flex-row" style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ margin: 0 }}>All Violations</h1>
        <span className="spacer" />
        <Link href="/officer/violations/new" className="btn btn-primary">
          + Submit new
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="muted">Loading…</p>}

      {!loading && violations.length === 0 && (
        <p className="muted">No violations yet.</p>
      )}

      {violations.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Plate</th>
                <th>Type</th>
                <th>Location</th>
                <th>Timestamp</th>
                <th>Status</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {violations.map((v) => (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td>{v.plate}</td>
                  <td>{v.violation_type}</td>
                  <td>{v.location}</td>
                  <td>{new Date(v.timestamp).toLocaleString()}</td>
                  <td>{v.invoice_status ? <span className={`badge badge-${v.invoice_status}`}>{v.invoice_status}</span> : "pending"}</td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "0.25rem 0.65rem", fontSize: "0.8rem" }}
                      onClick={() => openDetail(v.id)}
                      disabled={detailLoading}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <DetailPanel detail={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function DetailPanel({ detail, onClose }: { detail: ViolationDetail; onClose: () => void }) {
  const { violation: v, invoice } = detail;
  return (
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
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-row" style={{ marginBottom: "1rem" }}>
          <h2 style={{ margin: 0 }}>Violation #{v.id}</h2>
          <span className="spacer" />
          <button className="btn btn-secondary" style={{ padding: "0.2rem 0.6rem" }} onClick={onClose}>
            ✕
          </button>
        </div>

        <dl style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "0.4rem 1rem", fontSize: "0.9rem" }}>
          <dt className="muted">Plate</dt><dd>{v.plate}</dd>
          <dt className="muted">Type</dt><dd>{v.violation_type}</dd>
          <dt className="muted">Location</dt><dd>{v.location}</dd>
          <dt className="muted">Timestamp</dt><dd>{new Date(v.timestamp).toLocaleString()}</dd>
          <dt className="muted">Submitted by</dt><dd>User #{v.submitted_by}</dd>
          <dt className="muted">Status</dt><dd>{v.invoice_status ? <span className={`badge badge-${v.invoice_status}`}>{v.invoice_status}</span> : "pending"}</dd>
        </dl>

        {photoUrl(v.photo_path) && (
          <div style={{ marginTop: "1rem" }}>
            <h3 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Photo</h3>
            <img
              src={photoUrl(v.photo_path) ?? undefined}
              alt={`Violation ${v.id}`}
              style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)" }}
            />
          </div>
        )}

        {invoice && (
          <>
            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1rem 0" }} />
            <h2>Invoice #{invoice.id}</h2>
            <dl style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "0.4rem 1rem", fontSize: "0.9rem" }}>
              <dt className="muted">Base Amount</dt><dd>{formatIDR(invoice.base_amount)}</dd>
              <dt className="muted">Time ×</dt><dd>{invoice.time_multiplier}</dd>
              <dt className="muted">Repeat ×</dt><dd>{invoice.repeat_multiplier}</dd>
              <dt className="muted">Fine Amount</dt><dd><strong>{formatIDR(invoice.fine_amount)}</strong></dd>
              <dt className="muted">Status</dt>
              <dd><span className={`badge badge-${invoice.status}`}>{invoice.status}</span></dd>
            </dl>
          </>
        )}
      </div>
    </div>
  );
}
