"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/**
 * Root route — redirect based on role, or to /login if not authenticated.
 */
export default function RootPage() {
  const { claims, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!claims) {
      router.replace("/login");
    } else if (claims.role === "officer") {
      router.replace("/officer/violations");
    } else {
      router.replace("/member/dashboard");
    }
  }, [claims, loading, router]);

  return null;
}
