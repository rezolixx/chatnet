"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { MemberAvatar } from "@/components/community/MemberAvatar";
import { Icon } from "@/components/ui/Icons";
import type { ChatProfile } from "@/lib/auth/chat-profile";
import { buildAuthenticatedChatUrl } from "@/lib/chat";

const unavailable = "Votre profil chat est temporairement indisponible. Veuillez réessayer.";
const connectionError = "Impossible de se connecter au chat pour le moment. Veuillez réessayer.";

function isChatProfile(value: unknown, nickname: string): value is ChatProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const profile = value as Record<string, unknown>;
  return profile.nickname === nickname && (profile.avatar === null || typeof profile.avatar === "string")
    && typeof profile.age === "number" && Number.isInteger(profile.age) && profile.age >= 16 && profile.age <= 120
    && (profile.gender === "Homme" || profile.gender === "Femme")
    && typeof profile.pays === "string" && Boolean(profile.pays);
}

export function AuthenticatedChatCard({ nickname, selectedRoom }: { nickname: string; selectedRoom?: string }) {
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState<ChatProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const pendingRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const blankWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    requestRef.current = controller;
    async function loadProfile() {
      try {
        const response = await fetch("/api/auth/chat-profile", { cache: "no-store", signal: controller.signal });
        if (controller.signal.aborted) return;
        if (response.status === 401 || response.status === 419) {
          await refreshUser(true);
          return;
        }
        if (!response.ok) throw new Error("Profile unavailable");
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || !("profile" in data) || !isChatProfile(data.profile, nickname)) throw new Error("Invalid profile");
        if (!controller.signal.aborted) setProfile(data.profile);
      } catch {
        if (!controller.signal.aborted) setError(unavailable);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadProfile();
    return () => {
      requestRef.current?.abort();
      controller.abort();
      requestRef.current = null;
      if (blankWindowRef.current && !blankWindowRef.current.closed) blankWindowRef.current.close();
      blankWindowRef.current = null;
    };
  }, [nickname, refreshUser]);

  async function joinChat() {
    if (!profile || pendingRef.current) return;
    setError("");
    // The blank tab must be opened by the click, before the asynchronous preparation.
    let chatWindow: Window | null = null;
    try { chatWindow = window.open("", "_blank"); }
    catch { /* Treat a blocked popup like a null result. */ }
    if (!chatWindow) {
      setError("Votre navigateur a bloqué l’ouverture du chat. Autorisez les fenêtres pour Chatnet, puis réessayez.");
      return;
    }
    try { chatWindow.opener = null; }
    catch {
      chatWindow.close();
      setError(connectionError);
      return;
    }
    blankWindowRef.current = chatWindow;
    pendingRef.current = true;
    setPending(true);
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch("/api/auth/chat/prepare", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 419) {
        chatWindow.close();
        blankWindowRef.current = null;
        await refreshUser(true);
        return;
      }
      if (!response.ok) throw new Error("Chat preparation unavailable");
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid chat preparation");
      const prepared = data as Record<string, unknown>;
      if (prepared.nickname !== profile.nickname || typeof prepared.token !== "string" || !prepared.token
        || (prepared.ticket !== undefined && (typeof prepared.ticket !== "string" || !prepared.ticket))) throw new Error("Invalid chat credentials");
      if (controller.signal.aborted || chatWindow.closed) throw new Error("Chat window unavailable");
      chatWindow.location.href = buildAuthenticatedChatUrl({
        nick: profile.nickname,
        age: String(profile.age),
        sexe: profile.gender === "Homme" ? "M" : "F",
        ville: profile.pays,
      }, prepared.token, prepared.ticket as string | undefined, selectedRoom);
      blankWindowRef.current = null;
    } catch {
      if (!chatWindow.closed) chatWindow.close();
      blankWindowRef.current = null;
      if (requestRef.current === controller) setError(connectionError);
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPending(false);
      }
      pendingRef.current = false;
    }
  }

  return <div className="chat-join-card member-chat-card" id="rejoindre">
    {loading ? <div className="member-chat-loading" role="status" aria-label="Chargement du profil membre"><span className="member-chat-skeleton avatar" /><span className="member-chat-skeleton title" /><span className="member-chat-skeleton line" /><span className="member-chat-skeleton line" /><span className="member-chat-skeleton button" /></div>
      : <>
        <div className="member-chat-identity"><MemberAvatar member={profile ?? { nickname, avatar: null }} /><div><span className="chat-join-eyebrow">Membre Chatnet</span><h2>{profile?.nickname ?? nickname}</h2></div></div>
        {profile && <><dl className="member-chat-details"><div><dt>Âge</dt><dd>{profile.age} ans</dd></div><div><dt>Genre</dt><dd>{profile.gender}</dd></div><div><dt>Pays</dt><dd>{profile.pays}</dd></div></dl><button type="button" className="button button-primary chat-join-submit" onClick={joinChat} disabled={pending}>{pending ? "Connexion..." : "Rejoindre le Chat"}{!pending && <Icon name="arrow" size={18} />}</button></>}
        {error && <p className="chat-join-error" role="alert">{error}</p>}
      </>}
  </div>;
}
