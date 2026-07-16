/**
 * Thin localStorage helpers for token management + role extraction.
 * The JWT payload is base64url — we decode it client-side to read
 * {sub, role, exp} without verifying the signature (only the Go
 * backend verifies signatures; here we only need the payload for UX).
 */

export interface TokenClaims {
  sub: number;    // user id
  role: "officer" | "member";
  exp: number;    // unix timestamp
}

export function saveToken(token: string): void {
  localStorage.setItem("token", token);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function removeToken(): void {
  localStorage.removeItem("token");
}

/** Decode the JWT payload. Returns null if the token is missing or malformed. */
export function parseClaims(token: string): TokenClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // base64url → base64 → JSON
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded);
    return JSON.parse(json) as TokenClaims;
  } catch {
    return null;
  }
}

export function isTokenExpired(claims: TokenClaims): boolean {
  return Date.now() / 1000 > claims.exp;
}

/** Returns the stored, valid claims — or null if missing/expired. */
export function getCurrentClaims(): TokenClaims | null {
  const token = getToken();
  if (!token) return null;
  const claims = parseClaims(token);
  if (!claims || isTokenExpired(claims)) {
    removeToken();
    return null;
  }
  return claims;
}
