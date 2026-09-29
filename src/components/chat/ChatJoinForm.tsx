"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icons";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthenticatedChatCard } from "./AuthenticatedChatCard";
import { buildChatUrl, ORIGIN_TICKET_URL, type ChatJoinDetails } from "@/lib/chat";

type Field = "nick" | "age" | "sexe" | "ville";
type FieldErrors = Partial<Record<Field, string>>;

const nickPattern = /^[a-zA-Z0-9_\[\]{}^`|-]{2,16}$/;
const connectionError = "Impossible de se connecter au chat pour le moment. Veuillez réessayer.";

function validate(details: { nick: string; age: string; sexe: string; ville: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (!details.nick) errors.nick = "Entrez votre pseudo.";
  else if (!nickPattern.test(details.nick)) errors.nick = "Utilisez 2 à 16 caractères : lettres sans accents, chiffres ou _[]{}^`|-.";

  if (!details.age) errors.age = "Entrez votre âge.";
  else if (!/^\d+$/.test(details.age) || Number(details.age) < 16 || Number(details.age) > 99) errors.age = "L’âge doit être un nombre entier entre 16 et 99 ans.";

  if (details.sexe !== "M" && details.sexe !== "F") errors.sexe = "Choisissez une option.";
  if (!details.ville) errors.ville = "Entrez votre ville ou pays.";
  return errors;
}

export function ChatJoinForm() {
  const { user, loading } = useAuth();
  if (loading) return <div className="chat-join-card member-chat-loading" id="rejoindre" role="status" aria-label="Vérification de la session"><span className="member-chat-skeleton avatar" /><span className="member-chat-skeleton title" /><span className="member-chat-skeleton line" /><span className="member-chat-skeleton line" /><span className="member-chat-skeleton button" /></div>;
  if (user) return <AuthenticatedChatCard key={user.nickname} nickname={user.nickname} />;
  return <GuestChatJoinForm />;
}

function GuestChatJoinForm() {
  const [nick, setNick] = useState("");
  const [age, setAge] = useState("");
  const [sexe, setSexe] = useState<"M" | "F" | "">("");
  const [ville, setVille] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const blankWindowRef = useRef<Window | null>(null);
  const locationEditedRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    async function prefillLocation() {
      try {
        const response = await fetch("/api/location", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || !("location" in data) || typeof data.location !== "string" || !data.location.trim()) return;
        const location = data.location.trim();
        if (!controller.signal.aborted) setVille((current) => locationEditedRef.current || current ? current : location);
      } catch {
        // Location is optional; the visitor can enter it manually.
      }
    }
    void prefillLocation();
    return () => controller.abort();
  }, []);

  useEffect(() => () => {
    controllerRef.current?.abort();
    if (blankWindowRef.current && !blankWindowRef.current.closed) blankWindowRef.current.close();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;

    const details = { nick: nick.trim(), age: age.trim(), sexe, ville: ville.trim() };
    const nextErrors = validate(details);
    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) {
      const firstField = Object.keys(nextErrors)[0];
      (event.currentTarget.elements.namedItem(firstField) as HTMLElement | null)?.focus();
      return;
    }

    pendingRef.current = true;
    setPending(true);
    let chatWindow: Window | null = null;
    try {
      // Open from the submit gesture so popup blockers do not discard the chat tab.
      chatWindow = window.open("", "_blank");
      if (!chatWindow) {
        setFormError("Votre navigateur a bloqué l’ouverture du chat. Autorisez les fenêtres pour Chatnet, puis réessayez.");
        return;
      }
      blankWindowRef.current = chatWindow;
      chatWindow.opener = null;

      const controller = new AbortController();
      controllerRef.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(ORIGIN_TICKET_URL, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Origin ticket HTTP ${response.status}`);
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || !("ticket" in data) || typeof data.ticket !== "string" || !data.ticket.trim()) {
          throw new Error("Origin ticket missing from response");
        }
        if (chatWindow.closed) throw new Error("Chat window closed before redirect");
        chatWindow.location.href = buildChatUrl(details as ChatJoinDetails, data.ticket);
        blankWindowRef.current = null;
      } finally {
        window.clearTimeout(timeout);
        controllerRef.current = null;
      }
    } catch (error) {
      console.error("Chatnet origin ticket request failed:", error);
      if (chatWindow && !chatWindow.closed) chatWindow.close();
      blankWindowRef.current = null;
      setFormError(connectionError);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return <div className="chat-join-card" id="rejoindre">
    <div className="chat-join-head"><span className="chat-join-mark"><Icon name="chat" size={20} /></span><div><span className="chat-join-eyebrow">Entrez dans la conversation</span><h2>Rejoindre maintenant</h2></div></div>
    <p className="chat-join-intro">Choisissez un pseudo et retrouvez le salon #Accueil.</p>
    <form onSubmit={handleSubmit} noValidate>
      <div className="chat-join-field"><label htmlFor="join-nick">Pseudo</label><input id="join-nick" name="nick" value={nick} onChange={(event) => setNick(event.target.value)} placeholder="Entrez votre pseudo" autoComplete="nickname" maxLength={16} aria-invalid={Boolean(errors.nick)} aria-describedby={errors.nick ? "join-nick-error" : undefined} required />{errors.nick && <span id="join-nick-error" className="field-error">{errors.nick}</span>}</div>
      <div className="chat-join-field"><label htmlFor="join-age">Âge</label><input id="join-age" name="age" type="number" min={16} max={99} step={1} inputMode="numeric" value={age} onChange={(event) => setAge(event.target.value)} placeholder="Entrez votre âge" aria-invalid={Boolean(errors.age)} aria-describedby={errors.age ? "join-age-error" : undefined} required />{errors.age && <span id="join-age-error" className="field-error">{errors.age}</span>}</div>
      <fieldset className="chat-join-gender" aria-invalid={Boolean(errors.sexe)} aria-describedby={errors.sexe ? "join-sexe-error" : undefined}><legend>Genre</legend><div className="gender-options"><label className={sexe === "M" ? "selected" : ""}><input type="radio" name="sexe" value="M" checked={sexe === "M"} onChange={() => setSexe("M")} required /><span>Homme</span></label><label className={sexe === "F" ? "selected" : ""}><input type="radio" name="sexe" value="F" checked={sexe === "F"} onChange={() => setSexe("F")} required /><span>Femme</span></label></div>{errors.sexe && <span id="join-sexe-error" className="field-error">{errors.sexe}</span>}</fieldset>
      <div className="chat-join-field"><label htmlFor="join-ville">Ville / Pays</label><input id="join-ville" name="ville" value={ville} onChange={(event) => { locationEditedRef.current = true; setVille(event.target.value); }} placeholder="Votre ville ou pays" autoComplete="address-level2" aria-invalid={Boolean(errors.ville)} aria-describedby={errors.ville ? "join-ville-error" : undefined} required />{errors.ville && <span id="join-ville-error" className="field-error">{errors.ville}</span>}</div>
      {formError && <p className="chat-join-error" role="alert">{formError}</p>}
      <button type="submit" className="button button-primary chat-join-submit" disabled={pending}>{pending ? "Connexion..." : "Rejoindre le Chat"}{!pending && <Icon name="arrow" size={18} />}</button>
    </form>
  </div>;
}
