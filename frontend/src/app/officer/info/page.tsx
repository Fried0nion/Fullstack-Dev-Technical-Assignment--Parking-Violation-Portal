"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { getMe } from "@/lib/api";
import type { User } from "@/lib/types";

export default function OfficerInfoPage() {
  return (
    <ProtectedRoute role="officer">
      <OfficerInfo />
    </ProtectedRoute>
  );
}

function OfficerInfo() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="page"><p className="muted">Loading…</p></div>;
  }

  return (
    <div className="page">
      <h1>Officer Information</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ maxWidth: 520 }}>
        <dl style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "0.4rem 1rem", fontSize: "0.95rem" }}>
          <dt className="muted">Email</dt><dd>{user?.email}</dd>
          <dt className="muted">Officer ID</dt><dd>#{user?.id}</dd>
          <dt className="muted">Role</dt><dd>{user?.role}</dd>
        </dl>
      </div>
    </div>
  );
}