"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { SafeUser } from "@/lib/auth/types";

type AuthContextValue = {
  user: SafeUser | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: (invalidate?: boolean) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const authVersion = useRef(0);

  const refreshUser = useCallback(async (invalidate = false) => {
    if (invalidate) {
      authVersion.current += 1;
      setUser(null);
    }
    const version = authVersion.current;
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (version !== authVersion.current) return;
      if (response.status === 401) { setUser(null); return; }
      if (response.ok) {
        const data: { user: SafeUser } = await response.json();
        if (version === authVersion.current) setUser(data.user);
      }
    } catch { /* Keep current state when the service is temporarily unavailable. */ }
    finally { if (version === authVersion.current) setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    const version = authVersion.current;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!active || version !== authVersion.current) return;
        if (response.status === 401) setUser(null);
        else if (response.ok) {
          const data: { user: SafeUser } = await response.json();
          if (active && version === authVersion.current) setUser(data.user);
        }
      })
      .catch(() => { /* The session can be checked again later. */ })
      .finally(() => { if (active && version === authVersion.current) setLoading(false); });
    return () => { active = false; };
  }, []);

  const login = useCallback(async (identity: string, password: string) => {
    let response: Response;
    try {
      response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: identity, password }),
        cache: "no-store",
      });
    } catch { throw new Error("Connexion temporairement indisponible."); }
    if (!response.ok) {
      if (response.status === 401) throw new Error("Identifiants incorrects.");
      if (response.status === 429) throw new Error("Trop de tentatives. Réessayez plus tard.");
      if (response.status === 419) throw new Error("Session expirée. Réessayez.");
      throw new Error("Connexion temporairement indisponible.");
    }
    const data: { user: SafeUser } = await response.json();
    authVersion.current += 1;
    setUser(data.user);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
      if (response.status !== 403) { authVersion.current += 1; setUser(null); }
    } catch { throw new Error("Déconnexion temporairement indisponible."); }
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider is missing");
  return context;
}
