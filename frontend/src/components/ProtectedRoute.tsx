"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

interface Props {
  role: "officer" | "member";
  children: React.ReactNode;
}

/**
 * Wraps a page and redirects to /login if the user isn't authenticated
 * or doesn't have the required role.
 */
export default function ProtectedRoute({ role, children }: Props) {
  const { claims, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!claims) {
      router.replace("/login");
      return;
    }
    if (claims.role !== role) {
      // Redirect to the correct home for the actual role.
      router.replace(claims.role === "officer" ? "/officer/violations" : "/member/dashboard");
    }
  }, [claims, loading, role, router]);

  if (loading || !claims || claims.role !== role) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
        <p>Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
