"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { submitViolation } from "@/lib/api";
import type { SubmitViolationResponse } from "@/lib/types";
import styles from "./new.module.css";

function formatIDR(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function localNow(): string {
  const d = new Date();
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function photoUrl(photoPath?: string | null) {
  if (!photoPath) return null;
  const normalized = photoPath.replace(/^\\+|^\/+/, "");
  const filename = normalized.split(/[\\/]/).pop();
  return filename ? `/uploads/${filename}` : null;
}

export default function SubmitViolationPage() {
  return (
    <ProtectedRoute role="officer">
      <SubmitViolationForm />
    </ProtectedRoute>
  );
}

function SubmitViolationForm() {
  const router = useRouter();

  const [plate, setPlate] = useState("");
  const [type, setType] = useState("illegal_parking");
  const [location, setLocation] = useState("");
  const [timestamp, setTimestamp] = useState(localNow());
  const [photo, setPhoto] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmitViolationResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setSubmitting(true);
    try {
      const res = await submitViolation({ plate, violation_type: type, location, timestamp, photo });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const { violation, invoice } = result;
    return (
      <div className="page">
        <h1>Violation Submitted</h1>
        <div className="alert alert-success">
          Violation #{violation.id} created and invoice #{invoice.id} generated.
        </div>

        <div className="card" style={{ marginTop: "1rem" }}>
          <h2>Violation</h2>
          <dl className={styles.dl}>
            <dt>Plate</dt><dd>{violation.plate}</dd>
            <dt>Type</dt><dd>{violation.violation_type}</dd>
            <dt>Location</dt><dd>{violation.location}</dd>
            <dt>Timestamp</dt><dd>{new Date(violation.timestamp).toLocaleString()}</dd>
          </dl>
          {photoUrl(violation.photo_path) && (
            <div style={{ marginTop: "1rem" }}>
              <h3 style={{ marginBottom: "0.5rem" }}>Photo</h3>
              <img
                src={photoUrl(violation.photo_path) ?? undefined}
                alt={`Violation ${violation.id}`}
                style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)" }}
              />
            </div>
          )}
        </div>

        <div className="card" style={{ marginTop: "1rem" }}>
          <h2>Invoice</h2>
          <dl className={styles.dl}>
            <dt>Invoice ID</dt><dd>#{invoice.id}</dd>
            <dt>Base Amount</dt><dd>{formatIDR(invoice.base_amount)}</dd>
            <dt>Time Multiplier</dt><dd>{invoice.time_multiplier}×</dd>
            <dt>Repeat Multiplier</dt><dd>{invoice.repeat_multiplier}×</dd>
            <dt>Fine Amount</dt><dd><strong>{formatIDR(invoice.fine_amount)}</strong></dd>
            <dt>Status</dt>
            <dd><span className={`badge badge-${invoice.status}`}>{invoice.status}</span></dd>
          </dl>
        </div>

        <div className="flex-row" style={{ marginTop: "1.5rem" }}>
          <button className="btn btn-primary" onClick={() => { setResult(null); setPlate(""); setLocation(""); }}>
            Submit another
          </button>
          <button className="btn btn-secondary" onClick={() => router.push("/officer/violations")}>
            View all violations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Submit Violation</h1>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="plate">License Plate</label>
            <input
              id="plate"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="B1234XYZ"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="type">Violation Type</label>
            <select id="type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="illegal_parking">Illegal Parking</option>
              <option value="no_helmet">No Helmet</option>
              <option value="speeding">Speeding</option>
              <option value="red_light">Red Light</option>
              <option value="wrong_way">Wrong Way</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="location">Location</label>
            <input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Jl. Merdeka No. 1"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="timestamp">Timestamp</label>
            <input
              id="timestamp"
              type="datetime-local"
                className={styles.timestampInput}
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="photo">Photo (optional)</label>
            <input
              id="photo"
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit violation"}
          </button>
        </form>
      </div>
    </div>
  );
}
