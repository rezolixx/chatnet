"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { AvatarEditor } from "./AvatarEditor";
import type { OwnProfile } from "@/lib/auth/own-profile";

function ProfileSkeleton() {
  return <div className="profile-card profile-skeleton" aria-label="Chargement du profil" aria-busy="true">
    <span className="profile-skeleton-avatar" /><span className="profile-skeleton-line" /><span className="profile-skeleton-line short" />
    <div className="profile-grid"><span className="profile-skeleton-panel" /><span className="profile-skeleton-panel" /><span className="profile-skeleton-panel" /><span className="profile-skeleton-panel" /></div>
  </div>;
}

function display(value: string | null): string { return value || "Non renseigné"; }

export function ProfileContent() {
  const router = useRouter();
  const { user, loading, refreshUser } = useAuth();
  const nickname = user?.nickname;
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!nickname) { router.replace("/connexion"); return; }
    const controller = new AbortController();
    fetch("/api/auth/profile", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          await refreshUser(true);
          router.replace("/connexion");
          return;
        }
        if (!response.ok) throw new Error("Votre profil est temporairement indisponible.");
        const data: { profile: OwnProfile } = await response.json();
        if (!controller.signal.aborted) setProfile(data.profile);
      })
      .catch(() => { if (!controller.signal.aborted) setError("Votre profil est temporairement indisponible."); })
      .finally(() => { if (!controller.signal.aborted) setFetching(false); });
    return () => controller.abort();
  }, [loading, nickname, router, refreshUser]);

  if (loading || !user || fetching) return <ProfileSkeleton />;
  if (error || !profile) return <div className="profile-card" role="alert">{error || "Votre profil est temporairement indisponible."}</div>;

  const birthdate = profile.birthdate ? new Date(`${profile.birthdate}T00:00:00Z`) : null;
  const formattedBirthdate = birthdate && !Number.isNaN(birthdate.getTime()) ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(birthdate) : null;
  const details = [
    ["E-mail", profile.email],
    ["Date de naissance", formattedBirthdate],
    ["Genre", profile.gender],
    ["Pays", profile.pays],
    ["Membre depuis", profile.inscritDepuis],
  ];
  return <article className="profile-card">
    <div className="profile-head"><AvatarEditor nickname={profile.nickname} avatar={profile.avatar} onUploaded={(avatar) => setProfile((current) => current?.nickname === profile.nickname ? { ...current, avatar } : current)} /><div><span className="eyebrow">Membre Chatnet</span><h2>{profile.nickname}</h2></div></div>
    <div className="profile-grid">{details.map(([label, value]) => <div className="profile-detail" key={label}><span>{label}</span><strong>{display(value)}</strong></div>)}</div>
  </article>;
}
