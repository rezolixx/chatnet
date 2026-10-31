"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { memberFetch } from "@/lib/auth/member-fetch";
import {
  channelCategories, channelRequestMessages, channelStatusLabels, safeChannelRequestErrors,
  validateChannelRequestInput, type ChannelCategory, type ChannelRequestErrors, type OwnChannelRequest,
} from "@/lib/channels/requests";

const categoryNames: Record<ChannelCategory, string> = {
  general: "Discussion générale", jeux: "Jeux", musique: "Musique",
  entraide: "Entraide", culture: "Culture", autre: "Autre",
};

type Availability = "loading" | "ready" | "disabled" | "unavailable";
type ResponseCode = { code?: string; message?: string; errors?: unknown; status?: unknown; id?: unknown };

export function ChannelRequestForm() {
  const { user, loading, refreshUser } = useAuth();
  const [availability, setAvailability] = useState<Availability>("loading");
  const [requests, setRequests] = useState<OwnChannelRequest[]>([]);
  const [channel, setChannel] = useState("");
  const [category, setCategory] = useState<ChannelCategory>("general");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [errors, setErrors] = useState<ChannelRequestErrors>({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);

  const reload = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await memberFetch("/api/channels/requests", { cache: "no-store", credentials: "same-origin", signal });
      if (signal?.aborted) return;
      if (response.status === 404) { setAvailability("disabled"); return; }
      if (response.status === 401) { await refreshUser(true); setAvailability("unavailable"); return; }
      if (!response.ok) { setAvailability("unavailable"); return; }
      const payload: { requests?: OwnChannelRequest[] } = await response.json();
      if (!Array.isArray(payload.requests)) { setAvailability("unavailable"); return; }
      setRequests(payload.requests);
      setAvailability("ready");
    } catch {
      if (!signal?.aborted) setAvailability("unavailable");
    }
  }, [refreshUser]);

  useEffect(() => {
    if (loading || !user) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => { if (!controller.signal.aborted) return reload(controller.signal); });
    return () => controller.abort();
  }, [loading, user?.nickname, reload, user]);

  function resetForm() {
    setRevisionId(null);
    setChannel(""); setCategory("general"); setDescription(""); setTopic("");
    setRulesAccepted(false); setErrors({});
  }

  function revise(request: OwnChannelRequest) {
    if (pending.current || request.status !== "changes_requested") return;
    setRevisionId(request.id);
    setChannel(request.channel); setCategory(request.category);
    setDescription(request.description); setTopic(request.topic);
    setRulesAccepted(false); setErrors({}); setFormError(""); setNotice("");
    document.getElementById("channel-request-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || availability !== "ready") return;
    setNotice(""); setFormError("");
    const checked = validateChannelRequestInput({ channel, category, description, topic, accept_rules: rulesAccepted });
    setErrors(checked.errors);
    if (!checked.input) { if (!Object.keys(checked.errors).length) setFormError("Formulaire invalide."); return; }

    pending.current = true;
    setSubmitting(true);
    try {
      const response = await memberFetch(revisionId ? `/api/channels/requests/${revisionId}` : "/api/channels/requests", {
        method: revisionId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checked.input),
        credentials: "same-origin", cache: "no-store",
      });
      if (response.status === 401) { setFormError("Session expirée. Reconnectez-vous."); await refreshUser(true); return; }
      if (response.status === 404 && !revisionId) { setAvailability("disabled"); return; }
      const body: ResponseCode = await response.json().catch(() => ({}));
      if (response.status === 422) { setErrors(safeChannelRequestErrors(body)); setFormError("Vérifiez les champs de votre demande."); return; }
      if (!response.ok) {
        const messages: Record<number, string> = {
          403: "Votre profil Chatnet doit être vérifié pour demander un salon.",
          404: "Cette demande n'est plus modifiable.",
          409: "Ce salon existe déjà, ou la demande n'est plus modifiable.",
          429: "Deux demandes en cours maximum par membre. Réessayez plus tard.",
        };
        setFormError(messages[response.status] ?? "Envoi non confirmé. Vérifiez vos demandes avant de réessayer.");
        return;
      }
      if (body.status !== "pending" || typeof body.id !== "string") throw new Error("Invalid acknowledgement");
      setNotice(revisionId ? "Vos modifications ont été envoyées pour validation." : "Votre demande a bien été enregistrée. L’équipe va l’examiner.");
      resetForm();
      await reload();
    } catch { setFormError("Envoi non confirmé. Vérifiez vos demandes avant de réessayer."); }
    finally { pending.current = false; setSubmitting(false); }
  }

  if (loading) return <p role="status">Vérification de votre session…</p>;
  if (!user) return <><h2>Connectez-vous pour proposer un salon.</h2><p>La demande est réservée aux membres Chatnet disposant d’un profil vérifié.</p><Link href="/connexion" className="button button-primary">Se connecter</Link></>;
  if (availability === "loading") return <p role="status">Chargement de vos demandes…</p>;
  if (availability === "disabled") return <><span className="eyebrow">Bientôt disponible</span><h2>Les demandes de salons arrivent.</h2><p>La page est prête, mais la validation et l’ouverture des nouveaux salons ne sont pas encore activées. Aucune demande ne peut être envoyée pour le moment.</p><Link href="/salons" className="button button-outline">Voir les salons existants</Link></>;
  if (availability === "unavailable") return <><h2>Service momentanément indisponible.</h2><p>Impossible de consulter vos demandes pour le moment.</p><button type="button" className="button button-outline" onClick={() => { setAvailability("loading"); void reload(); }}>Réessayer</button></>;

  return <>
    <span className="eyebrow">Demande de création</span>
    <h2 id="channel-request-form">{revisionId ? `Modifier la demande ${channel}` : "Proposez votre salon."}</h2>
    <p>Votre demande est examinée par l’équipe. Votre compte Chatnet doit être vérifié. L’approbation ne crée pas immédiatement le salon.</p>
    <form onSubmit={submit} aria-busy={submitting} noValidate>
      <div className="chat-join-field"><label htmlFor="request-channel">Nom du salon</label><input id="request-channel" name="channel" value={channel} onChange={(event) => setChannel(event.target.value)} placeholder="#MonSalon" maxLength={34} required disabled={submitting || !!revisionId} aria-invalid={!!errors.channel} />{errors.channel && <span className="field-error" role="alert">{errors.channel}</span>}</div>
      <div className="chat-join-field"><label htmlFor="request-category">Catégorie</label><select id="request-category" name="category" value={category} onChange={(event) => setCategory(event.target.value as ChannelCategory)} disabled={submitting}>{channelCategories.map((key) => <option key={key} value={key}>{categoryNames[key]}</option>)}</select>{errors.category && <span className="field-error" role="alert">{errors.category}</span>}</div>
      <div className="chat-join-field"><label htmlFor="request-description">Description (15 à 500 caractères)</label><textarea id="request-description" name="description" rows={4} maxLength={500} required value={description} onChange={(event) => setDescription(event.target.value)} disabled={submitting} aria-invalid={!!errors.description} />{errors.description && <span className="field-error" role="alert">{errors.description}</span>}</div>
      <div className="chat-join-field"><label htmlFor="request-topic">Sujet affiché dans le salon (5 à 300 caractères)</label><textarea id="request-topic" name="topic" rows={3} maxLength={300} required value={topic} onChange={(event) => setTopic(event.target.value)} disabled={submitting} aria-invalid={!!errors.topic} />{errors.topic && <span className="field-error" role="alert">{errors.topic}</span>}</div>
      <label className="channel-request-consent"><input type="checkbox" name="accept_rules" checked={rulesAccepted} onChange={(event) => setRulesAccepted(event.target.checked)} disabled={submitting} /> <span>J’accepte les <Link href="/conditions">conditions d’utilisation</Link> et la modération du salon.</span></label>
      {errors.accept_rules && <span className="field-error" role="alert">{channelRequestMessages.accept_rules}</span>}
      {formError && <p className="chat-join-error" role="alert">{formError}</p>}
      {notice && <p className="auth-success" role="status">{notice}</p>}
      <div className="channel-request-actions"><button type="submit" className="button button-primary" disabled={submitting}>{submitting ? "Envoi…" : revisionId ? "Renvoyer la demande" : "Envoyer ma demande"}</button>{revisionId && <button type="button" className="button button-outline" disabled={submitting} onClick={() => { resetForm(); setFormError(""); }}>Annuler la modification</button>}</div>
    </form>
    <section className="channel-request-history" aria-label="Mes demandes de salons"><h3>Mes demandes</h3>{requests.length === 0 ? <p>Aucune demande pour le moment.</p> : <ul>{requests.map((item) => <li key={item.id}><div className="channel-request-history-head"><strong>{item.channel}</strong><span>{channelStatusLabels[item.status]}</span></div><p>{item.topic}</p>{item.rejection_reason && <p className="channel-request-reason">Retour de l’équipe : {item.rejection_reason}</p>}{item.status === "changes_requested" && <button type="button" className="button button-outline" disabled={submitting} onClick={() => revise(item)}>Modifier cette demande</button>}</li>)}</ul>}</section>
  </>;
}
