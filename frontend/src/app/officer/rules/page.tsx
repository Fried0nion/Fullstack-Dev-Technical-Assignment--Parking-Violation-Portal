"use client";

import { useCallback, useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { listRules, publishRule } from "@/lib/api";
import type { RuleVersion } from "@/lib/types";
import styles from "./rules.module.css";

export default function OfficerRulesPage() {
  return (
    <ProtectedRoute role="officer">
      <RulesView />
    </ProtectedRoute>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function parseKV(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of text.split("\n")) {
    const parts = line.split("=").map((s) => s.trim());
    if (parts.length === 2 && parts[0] && !isNaN(Number(parts[1]))) {
      out[parts[0]] = Number(parts[1]);
    }
  }
  return out;
}

// ── component ─────────────────────────────────────────────────────────────────

function RulesView() {
  const [rules, setRules] = useState<RuleVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);

  // form state
  const [baseAmounts, setBaseAmounts] = useState("illegal_parking = 100000\nno_helmet = 50000\nspeeding = 200000\nred_light = 150000\nwrong_way = 175000");
  const [dayMult, setDayMult] = useState("1.0");
  const [nightMult, setNightMult] = useState("1.5");
  const [nightStart, setNightStart] = useState("22");
  const [nightEnd, setNightEnd] = useState("6");
  const [repeatMults, setRepeatMults] = useState("1 = 1.5\n2 = 2.0");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listRules()
      .then(setRules)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      await publishRule({
        base_amounts: parseKV(baseAmounts),
        time_multipliers: {
          day: parseFloat(dayMult),
          night: parseFloat(nightMult),
          night_start_hour: parseInt(nightStart, 10),
          night_end_hour: parseInt(nightEnd, 10),
        },
        repeat_multipliers: parseKV(repeatMults),
      });
      setSuccess("New rule version published and is now active.");
      setShowForm(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="flex-row" style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ margin: 0 }}>Rule Versions</h1>
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setError(""); setSuccess(""); }}>
          {showForm ? "Cancel" : "+ Publish new"}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2>Publish New Rule Version</h2>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Publishing deactivates the current active rule. Existing invoices keep their snapshot.
          </p>
          <form onSubmit={handlePublish}>
            <div className="field">
              <label>Base Amounts (key = value, one per line)</label>
              <textarea
                rows={6}
                value={baseAmounts}
                onChange={(e) => setBaseAmounts(e.target.value)}
                style={{ fontFamily: "monospace", resize: "vertical" }}
              />
            </div>

            <div className={styles.row4}>
              <div className="field">
                <label>Day multiplier</label>
                <input type="number" step="0.1" value={dayMult} onChange={(e) => setDayMult(e.target.value)} />
              </div>
              <div className="field">
                <label>Night multiplier</label>
                <input type="number" step="0.1" value={nightMult} onChange={(e) => setNightMult(e.target.value)} />
              </div>
              <div className="field">
                <label>Night start hour</label>
                <input type="number" min="0" max="23" value={nightStart} onChange={(e) => setNightStart(e.target.value)} />
              </div>
              <div className="field">
                <label>Night end hour</label>
                <input type="number" min="0" max="23" value={nightEnd} onChange={(e) => setNightEnd(e.target.value)} />
              </div>
            </div>

            <div className="field">
              <label>Repeat multipliers (offense_count = multiplier, one per line)</label>
              <textarea
                rows={4}
                value={repeatMults}
                onChange={(e) => setRepeatMults(e.target.value)}
                style={{ fontFamily: "monospace", resize: "vertical" }}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Publishing…" : "Publish"}
            </button>
          </form>
        </div>
      )}

      {loading && <p className="muted">Loading…</p>}
      {!loading && rules.length === 0 && <p className="muted">No rule versions yet.</p>}

      {rules.map((rv) => (
        <RuleCard key={rv.id} rule={rv} />
      ))}
    </div>
  );
}

function RuleCard({ rule }: { rule: RuleVersion }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card" style={{ marginBottom: "0.75rem" }}>
      <div className="flex-row">
        <div>
          <strong>Version #{rule.id}</strong>
          <span className="muted" style={{ marginLeft: "0.75rem", fontSize: "0.85rem" }}>
            {new Date(rule.published_at).toLocaleString()}
          </span>
        </div>
        <span className="spacer" />
        {rule.is_active && <span className="badge badge-paid">Active</span>}
        <button
          className="btn btn-secondary"
          style={{ padding: "0.2rem 0.6rem", fontSize: "0.8rem" }}
          onClick={() => setOpen(!open)}
        >
          {open ? "Hide" : "Details"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: "1rem" }}>
          <h2 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Base Amounts</h2>
          <div className={styles.kv}>
            {Object.entries(rule.base_amounts).map(([k, v]) => (
              <span key={k} className={styles.kvItem}>
                <span className="muted">{k}</span>
                <span>{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v)}</span>
              </span>
            ))}
          </div>

          <h2 style={{ fontSize: "0.9rem", margin: "0.75rem 0 0.5rem" }}>Time Multipliers</h2>
          <div className={styles.kv}>
            <span className={styles.kvItem}><span className="muted">Day</span><span>{rule.time_multipliers.day}×</span></span>
            <span className={styles.kvItem}><span className="muted">Night</span><span>{rule.time_multipliers.night}×</span></span>
            <span className={styles.kvItem}><span className="muted">Night window</span><span>{rule.time_multipliers.night_start_hour}:00 → {rule.time_multipliers.night_end_hour}:00</span></span>
          </div>

          <h2 style={{ fontSize: "0.9rem", margin: "0.75rem 0 0.5rem" }}>Repeat Multipliers</h2>
          {Object.keys(rule.repeat_multipliers).length === 0 ? (
            <p className="muted">None configured.</p>
          ) : (
            <div className={styles.kv}>
              {Object.entries(rule.repeat_multipliers).map(([k, v]) => (
                <span key={k} className={styles.kvItem}>
                  <span className="muted">Offense {k}</span>
                  <span>{v}×</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
