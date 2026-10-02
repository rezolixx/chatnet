"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { AssistanceForm } from "./AssistanceForm";

export function AssistanceContent({ available }: { available: boolean }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace("/connexion");
  }, [loading, user, router]);
  if (loading || !user) return <div className="auth-card assistance-card" role="status" aria-busy="true">Vérification de votre session…</div>;
  if (!available) return <div className="auth-card assistance-card" role="alert">L’assistance est temporairement indisponible. Veuillez réessayer plus tard.</div>;
  return <div className="auth-card assistance-card"><h2>Contacter l’équipe</h2><p>Le message sera envoyé avec le pseudo et l’adresse e-mail de votre compte.</p><AssistanceForm key={user.nickname} /></div>;
}
