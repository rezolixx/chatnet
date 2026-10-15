"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AccountRefusalError, isAccountRestriction, readAccountRefusal, type AccountRefusal } from "@/lib/auth/account-restriction";
import { memberFetch, onAccountRefusal } from "@/lib/auth/member-fetch";
import type { SafeUser } from "@/lib/auth/types";

type AuthContextValue = {
  user: SafeUser | null;
  loading: boolean;
  // The API's latest Ban / Suspension refusal (or unreadable restriction
  // state), in memory only, for the site-wide notice. Never an authority:
  // the API decides again at the next sign-in or session check.
  accountRefusal: AccountRefusal | null;
  clearAccountRefusal: () => void;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: (invalidate?: boolean) => Promise<void>;
  updateAvatar: (nickname: string, avatar: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountRefusal, setAccountRefusal] = useState<AccountRefusal | null>(null);
  const authVersion = useRef(0);

  // Any member request refused by the API: a restriction ended the session
  // (the BFF cleared its cookies), so the member state goes too. An
  // unreadable restriction state refuses that flow only.
  useEffect(() => onAccountRefusal((refusal) => {
    setAccountRefusal(refusal);
    if (isAccountRestriction(refusal)) {
      authVersion.current += 1;
      setUser(null);
      setLoading(false);
    }
  }), []);

  const clearAccountRefusal = useCallback(() => setAccountRefusal(null), []);

  // Session check: a refusal (announced by memberFetch) leaves no member
  // signed in on this page, fail closed.
  const applySession = useCallback(async (response: Response, isCurrent: () => boolean) => {
    if (!isCurrent()) return;
    if (response.status === 401 || await readAccountRefusal(response)) { setUser(null); return; }
    if (response.ok) {
      const data: { user: SafeUser } = await response.json();
      if (isCurrent()) { setUser(data.user); setAccountRefusal(null); }
    }
  }, []);

  const refreshUser = useCallback(async (invalidate = false) => {
    if (invalidate) {
      authVersion.current += 1;
      setUser(null);
    }
    const version = authVersion.current;
    try {
      const response = await memberFetch("/api/auth/me", { cache: "no-store" });
      await applySession(response, () => version === authVersion.current);
    } catch { /* Keep current state when the service is temporarily unavailable. */ }
    finally { if (version === authVersion.current) setLoading(false); }
  }, [applySession]);

  useEffect(() => {
    let active = true;
    const version = authVersion.current;
    memberFetch("/api/auth/me", { cache: "no-store" })
      .then((response) => applySession(response, () => active && version === authVersion.current))
      .catch(() => { /* The session can be checked again later. */ })
      .finally(() => { if (active && version === authVersion.current) setLoading(false); });
    return () => { active = false; };
  }, [applySession]);

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
      // Ban / Suspension: shown site-wide too. Unreadable restriction state:
      // this sign-in only.
      const refusal = await readAccountRefusal(response);
      if (refusal) {
        if (isAccountRestriction(refusal)) {
          authVersion.current += 1;
          setUser(null);
          setAccountRefusal(refusal);
        }
        throw new AccountRefusalError(refusal);
      }
      if (response.status === 401) throw new Error("Identifiants incorrects.");
      if (response.status === 429) throw new Error("Trop de tentatives. Réessayez plus tard.");
      if (response.status === 419) throw new Error("Session expirée. Réessayez.");
      throw new Error("Connexion temporairement indisponible.");
    }
    const data: { user: SafeUser } = await response.json();
    authVersion.current += 1;
    setUser(data.user);
    setAccountRefusal(null);
    setLoading(false);
  }, []);

  const updateAvatar = useCallback((nickname: string, avatar: string) => {
    authVersion.current += 1;
    setUser((current) => current?.nickname === nickname ? { ...current, avatar } : current);
  }, []);

  const logout = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
      if (response.status !== 403) { authVersion.current += 1; setUser(null); }
    } catch { throw new Error("Déconnexion temporairement indisponible."); }
  }, []);

  return <AuthContext.Provider value={{ user, loading, accountRefusal, clearAccountRefusal, login, logout, refreshUser, updateAvatar }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider is missing");
  return context;
}
