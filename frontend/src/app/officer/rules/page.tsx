"use client";

import { useCallback, useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { activateRuleVersion, deleteRuleVersion, listRules, publishRule } from "@/lib/api";
import type { RuleVersion } from "@/lib/types";
import styles from "./rules.module.css";

const VIOLATION_TYPES = [
  { key: "illegal_parking", label: "Illegal parking" },
  { key: "no_helmet", label: "No helmet" },
  { key: "speeding", label: "Speeding" },
  { key: "red_light", label: "Red light" },
  { key: "wrong_way", label: "Wrong way" },
] as const;

type AmountDraft = Record<string, string>;

const DEFAULT_AMOUNTS: AmountDraft = {
  illegal_parking: "100000",
  no_helmet: "50000",
  speeding: "200000",
  red_light: "150000",
  wrong_way: "175000",
};

function formatIDR(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function parseRepeatMultipliers(text: string): Record<string, number> {
  return Object.fromEntries(
    text
      .split("\n")
      .map((line) => line.split("=").map((part) => part.trim()))
      .filter(([key, value]) => key && value && !Number.isNaN(Number(value)))
      .map(([key, value]) => [key, Number(value)])
  );
}

export default function OfficerRulesPage() {
  return (
    <ProtectedRoute role="officer">
      <RulesView />
    </ProtectedRoute>
  );
}

function RulesView() {
  const [rules, setRules] = useState<RuleVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [amounts, setAmounts] = useState<AmountDraft>(DEFAULT_AMOUNTS);
  const [dayMult, setDayMult] = useState("1.0");
  const [nightMult, setNightMult] = useState("1.5");
  const [nightStart, setNightStart] = useState("22:00");
  const [nightEnd, setNightEnd] = useState("06:00");
  const [repeatMults, setRepeatMults] = useState("1 = 1.5\n2 = 2.0");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listRules()
      .then(setRules)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      await publishRule({
        base_amounts: Object.fromEntries(VIOLATION_TYPES.map(({ key }) => [key, Number(amounts[key] ?? "")])) as Record<string, number>,
        time_multipliers: {
          day: Number(dayMult),
          night: Number(nightMult),
          night_start_hour: nightStart,
          night_end_hour: nightEnd,
        },
        repeat_multipliers: parseRepeatMultipliers(repeatMults),
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

  async function handleActivate(id: number) {
    setError("");
    setSuccess("");
    try {
      await activateRuleVersion(id);
      setSuccess(`Rule version #${id} is now active.`);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to activate version");
    }
  }

  async function handleDelete(id: number) {
    setError("");
    setSuccess("");
    if (!window.confirm(`Delete rule version #${id}?`)) return;
    try {
      await deleteRuleVersion(id);
      setSuccess(`Rule version #${id} deleted.`);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete version");
    }
  }

  return (
    <div className="page">
      <div className="flex-row" style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ margin: 0 }}>Rule Versions</h1>
        <span className="spacer" />
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm(!showForm);
            setError("");
            setSuccess("");
          }}
        >
          {showForm ? "Cancel" : "+ Publish new"}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2>Publish New Rule Version</h2>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Base amounts are fixed by violation type, so officers can change the values without removing a violation type.
          </p>
          <form onSubmit={handlePublish}>
            <div className={styles.amountGrid}>
              {VIOLATION_TYPES.map(({ key, label }) => (
                <div className={styles.amountRow} key={key}>
                  <label className={styles.amountKey} htmlFor={`amount-${key}`}>
                    {label}
                  </label>
                  <input
                    id={`amount-${key}`}
                    type="number"
                    min="0"
                    step="1"
                    value={amounts[key]}
                    onChange={(e) => setAmounts((current) => ({ ...current, [key]: e.target.value }))}
                    required
                  />
                </div>
              ))}
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
                <label>Night start time</label>
                <input type="time" step="60" value={nightStart} onChange={(e) => setNightStart(e.target.value)} />
              </div>
              <div className="field">
                <label>Night end time</label>
                <input type="time" step="60" value={nightEnd} onChange={(e) => setNightEnd(e.target.value)} />
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

      {rules.map((rule) => (
        <RuleCard key={rule.id} rule={rule} onActivate={handleActivate} onDelete={handleDelete} />
      ))}
    </div>
  );
}

function RuleCard({
  rule,
  onActivate,
  onDelete,
}: {
  rule: RuleVersion;
  onActivate: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card" style={{ marginBottom: "0.75rem" }}>
      <div className="flex-row" style={{ gap: "0.75rem", alignItems: "center" }}>
        <div>
          <strong>Version #{rule.id}</strong>
          <span className="muted" style={{ marginLeft: "0.75rem", fontSize: "0.85rem" }}>
            {new Date(rule.published_at).toLocaleString()}
          </span>
        </div>
        <span className="spacer" />
        {rule.is_active && <span className="badge badge-paid">Active</span>}
        {!rule.is_active && (
          <button className="btn btn-primary" style={{ padding: "0.2rem 0.6rem", fontSize: "0.8rem" }} onClick={() => onActivate(rule.id)}>
            Activate
          </button>
        )}
        {!rule.is_active && (
          <button className="btn btn-danger" style={{ padding: "0.2rem 0.6rem", fontSize: "0.8rem" }} onClick={() => onDelete(rule.id)}>
            Delete
          </button>
        )}
        <button className="btn btn-secondary" style={{ padding: "0.2rem 0.6rem", fontSize: "0.8rem" }} onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Details"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: "1rem" }}>
          <h2 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Base Amounts</h2>
          <div className={styles.kv}>
            {Object.entries(rule.base_amounts).map(([key, value]) => (
              <span key={key} className={styles.kvItem}>
                <span className="muted">{key}</span>
                <span>{formatIDR(value)}</span>
              </span>
            ))}
          </div>

          <h2 style={{ fontSize: "0.9rem", margin: "0.75rem 0 0.5rem" }}>Time Multipliers</h2>
          <div className={styles.kv}>
            <span className={styles.kvItem}>
              <span className="muted">Day</span>
              <span>{rule.time_multipliers.day}×</span>
            </span>
            <span className={styles.kvItem}>
              <span className="muted">Night</span>
              <span>{rule.time_multipliers.night}×</span>
            </span>
            <span className={styles.kvItem}>
              <span className="muted">Night window</span>
              <span>{rule.time_multipliers.night_start_hour} → {rule.time_multipliers.night_end_hour}</span>
            </span>
          </div>

          <h2 style={{ fontSize: "0.9rem", margin: "0.75rem 0 0.5rem" }}>Repeat Multipliers</h2>
          {Object.keys(rule.repeat_multipliers).length === 0 ? (
            <p className="muted">None configured.</p>
          ) : (
            <div className={styles.kv}>
              {Object.entries(rule.repeat_multipliers).map(([key, value]) => (
                <span key={key} className={styles.kvItem}>
                  <span className="muted">Offense {key}</span>
                  <span>{value}×</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
