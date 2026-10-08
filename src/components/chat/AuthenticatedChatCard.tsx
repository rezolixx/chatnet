"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { MemberAvatar } from "@/components/community/MemberAvatar";
import { Icon } from "@/components/ui/Icons";
import { PROFILE_BIRTHDATE_INVALID } from "@/lib/auth/age-policy";
import type { ChatProfile } from "@/lib/auth/chat-profile";
import { buildAuthenticatedChatUrl } from "@/lib/chat";
import { allowsLegacyChatFallback, CHAT_HANDOFF_REDEEM_URL, ChatEntryFailure, chatEntryMessages, chatEntryRefusal, DEFAULT_CHAT_ROOM, isChatHandoffCode } from "@/lib/chat-handoff";
import { roomJoinName } from "@/lib/rooms";

const unavailable = "Votre profil chat est temporairement indisponible. Veuillez réessayer.";
const connectionError = chatEntryMessages.CHAT_UNAVAILABLE;
// Birthdate outside the 16-120 age policy: entry waits for the member to correct it.
const birthdateRefused = "Votre date de naissance indique un âge hors des limites autorisées (16 à 120 ans). Corrigez-la dans votre profil pour accéder au chat.";

function responseCode(data: unknown): unknown {
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>).code : undefined;
}
const handoffTimeout = 20000;
const prepareTimeout = 25000;

// The code travels only in this POST body, into the already-opened chat window.
function submitHandoff(code: string, target: string) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = CHAT_HANDOFF_REDEEM_URL;
  form.target = target;
  form.hidden = true;
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "code";
  input.value = code;
  form.appendChild(input);
  document.body.appendChild(form);
  try { form.submit(); }
  finally { form.remove(); }
}

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
  const [birthdateBlocked, setBirthdateBlocked] = useState(false);
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
        if (response.status === 422) {
          const code = responseCode(await response.json().catch(() => null));
          if (code === PROFILE_BIRTHDATE_INVALID) {
            if (!controller.signal.aborted) setBirthdateBlocked(true);
            return;
          }
          // Gender or country to complete: no join button, no fallback.
          if (code === "PROFILE_INCOMPLETE") {
            if (!controller.signal.aborted) setError(chatEntryMessages.PROFILE_INCOMPLETE);
            return;
          }
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
    const room = selectedRoom === undefined ? DEFAULT_CHAT_ROOM : roomJoinName(selectedRoom);
    if (!room) {
      setError(chatEntryMessages.INVALID_ROOM);
      return;
    }
    // The tab must be opened by the click, before any request. Its unique
    // name lets the handoff form target this exact window.
    const target = `chatnet-chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    let opened: Window | null = null;
    try { opened = window.open("about:blank", target); }
    catch { /* Treat a blocked popup like a null result. */ }
    if (!opened) {
      setError("Votre navigateur a bloqué l’ouverture du chat. Autorisez les fenêtres pour Chatnet, puis réessayez.");
      return;
    }
    const chatWindow = opened;
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
    let submitted = false;

    // Resolves null after a network error or timeout; rejects once cancelled.
    async function post(url: string, body: string | undefined, timeoutMs: number): Promise<{ status: number; data: unknown } | null> {
      const attempt = new AbortController();
      const abort = () => attempt.abort();
      controller.signal.addEventListener("abort", abort);
      const timeout = window.setTimeout(abort, timeoutMs);
      try {
        const response = await fetch(url, {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          signal: attempt.signal,
          ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body }),
        });
        // Refusal bodies are the BFF's own { code } only.
        const text = await response.text();
        let data: unknown = null;
        try { data = JSON.parse(text); }
        catch { /* Rejected by the response validation. */ }
        return { status: response.status, data };
      } catch {
        if (controller.signal.aborted) throw new Error("Chat entry cancelled");
        return null;
      } finally {
        window.clearTimeout(timeout);
        controller.signal.removeEventListener("abort", abort);
      }
    }

    async function sessionExpired() {
      chatWindow.close();
      blankWindowRef.current = null;
      await refreshUser(true);
    }

    // Laravel refused the birthdate (age policy): no fallback, the member corrects it first.
    function birthdateRefusal() {
      chatWindow.close();
      blankWindowRef.current = null;
      if (requestRef.current === controller) setBirthdateBlocked(true);
    }

    try {
      const handoff = await post("/api/auth/chat/handoff", JSON.stringify({ room }), handoffTimeout);
      // Network error or timeout: retryable, never a legacy fallback.
      if (!handoff) throw new ChatEntryFailure("CHAT_UNAVAILABLE");
      if (handoff.status === 401 || handoff.status === 419) return await sessionExpired();
      if (handoff.status >= 200 && handoff.status < 300) {
        // An unexpected success is an error, never a silent legacy fallback.
        const code = handoff.data && typeof handoff.data === "object" ? (handoff.data as Record<string, unknown>).handoff : undefined;
        if (!isChatHandoffCode(code)) throw new Error("Invalid chat handoff");
        if (controller.signal.aborted || chatWindow.closed) throw new Error("Chat window unavailable");
        submitHandoff(code, target);
        submitted = true;
        blankWindowRef.current = null;
        return;
      }
      const handoffCode = responseCode(handoff.data);
      if (handoff.status === 422 && handoffCode === PROFILE_BIRTHDATE_INVALID) return birthdateRefusal();
      if (!allowsLegacyChatFallback(handoff.status, handoffCode)) throw new ChatEntryFailure(chatEntryRefusal(handoff.status, handoffCode));

      // Legacy flow, in the same tab and for the same room, only for an
      // account V2 cannot serve yet or with V2 off; Laravel refuses it to
      // every bound profile (CHAT_IDENTITY_V2_REQUIRED).
      const prepared = await post("/api/auth/chat/prepare", undefined, prepareTimeout);
      if (!prepared) throw new ChatEntryFailure("CHAT_UNAVAILABLE");
      if (prepared.status === 401 || prepared.status === 419) return await sessionExpired();
      if (prepared.status === 422 && responseCode(prepared.data) === PROFILE_BIRTHDATE_INVALID) return birthdateRefusal();
      if (prepared.status < 200 || prepared.status >= 300) throw new ChatEntryFailure(chatEntryRefusal(prepared.status, responseCode(prepared.data)));
      const data = prepared.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid chat preparation");
      const legacy = data as Record<string, unknown>;
      if (legacy.nickname !== profile.nickname || typeof legacy.token !== "string" || !legacy.token
        || (legacy.ticket !== undefined && (typeof legacy.ticket !== "string" || !legacy.ticket))) throw new Error("Invalid chat credentials");
      if (controller.signal.aborted || chatWindow.closed) throw new Error("Chat window unavailable");
      chatWindow.location.href = buildAuthenticatedChatUrl({
        nick: profile.nickname,
        age: String(profile.age),
        sexe: profile.gender === "Homme" ? "M" : "F",
        ville: profile.pays,
      }, legacy.token, legacy.ticket as string | undefined, room);
      blankWindowRef.current = null;
    } catch (failure) {
      if (!submitted && !chatWindow.closed) chatWindow.close();
      blankWindowRef.current = null;
      if (requestRef.current === controller) setError(failure instanceof ChatEntryFailure ? failure.message : connectionError);
    } finally {
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
        {profile && !birthdateBlocked && <><dl className="member-chat-details"><div><dt>Âge</dt><dd>{profile.age} ans</dd></div><div><dt>Genre</dt><dd>{profile.gender}</dd></div><div><dt>Pays</dt><dd>{profile.pays}</dd></div></dl><button type="button" className="button button-primary chat-join-submit" onClick={joinChat} disabled={pending}>{pending ? "Connexion..." : "Rejoindre le Chat"}{!pending && <Icon name="arrow" size={18} />}</button></>}
        {birthdateBlocked && <p className="chat-join-error" role="alert">{birthdateRefused} <Link href="/profil">Corriger ma date de naissance</Link></p>}
        {error && !birthdateBlocked && <p className="chat-join-error" role="alert">{error}</p>}
      </>}
  </div>;
}
