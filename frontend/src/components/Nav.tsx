"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import styles from "./Nav.module.css";

export default function Nav() {
  const { claims, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  if (!claims) return null;

  const isOfficer = claims.role === "officer";

  return (
    <nav className={styles.nav}>
      <span className={styles.brand}>Parking Portal</span>
      <div className={styles.links}>
        {isOfficer ? (
          <>
            <Link href="/officer/violations">Violations</Link>
            <Link href="/officer/violations/new">Submit</Link>
            <Link href="/officer/rules">Rules</Link>
            <Link href="/officer/info">Info</Link>
          </>
        ) : (
          <>
            <Link href="/member/dashboard">Dashboard</Link>
            <Link href="/member/payments">Payments</Link>
          </>
        )}
      </div>
      <div className={styles.right}>
        <span className={styles.role}>{claims.role}</span>
        <button onClick={handleLogout} className={styles.logout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
