"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getCurrentClaims,
  removeToken,
  saveToken,
  type TokenClaims,
} from "@/lib/auth";
import { login as apiLogin } from "@/lib/api";

interface AuthState {
  claims: TokenClaims | null;
  /** true while we haven't yet read localStorage on first mount */
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Lazy initialiser: reads localStorage synchronously on first render
  // (client-side only). This avoids a setState-inside-useEffect pattern.
  const [state, setState] = useState<AuthState>(() => {
    if (typeof window === "undefined") {
      return { claims: null, loading: true };
    }
    return { claims: getCurrentClaims(), loading: false };
  });

  // On the server the state starts as loading=true; once we hydrate on
  // the client the lazy initialiser above has already run, so this
  // effect is only needed to cover the SSR→CSR transition.
  useEffect(() => {
    if (state.loading) {
      setState({ claims: getCurrentClaims(), loading: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token } = await apiLogin(email, password);
    saveToken(token);
    const claims = getCurrentClaims();
    setState({ claims, loading: false });
  }, []);

  const logout = useCallback(() => {
    removeToken();
    setState({ claims: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
