"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrationCountries, registrationCountrySet } from "@/lib/auth/countries";
import type { OwnProfile } from "@/lib/auth/own-profile";
import { validateProfileUpdate, type ProfileUpdateErrors, type ProfileUpdateField } from "@/lib/auth/profile-update";
import { useAuth } from "./AuthProvider";

const sortedCountries = [...registrationCountries].sort((a, b) => a.localeCompare(b, "fr"));

export function ProfileEditForm({ profile, onSaved, onCancel }: { profile: OwnProfile; onSaved: (profile: OwnProfile) => void; onCancel: () => void }) {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [birthdate, setBirthdate] = useState(profile.birthdate ?? "");
  const [pays, setPays] = useState(profile.pays ?? "");
  const [errors, setErrors] = useState<ProfileUpdateErrors>({});
  const [saving, setSaving] = useState<ProfileUpdateField | null>(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");

  async function save(field: ProfileUpdateField) {
    if (saving) return;
    setErrors({});
    setMessage("");
    setSuccess("");
    const candidate = field === "birthdate" ? { birthdate } : { pays };
    const checked = validateProfileUpdate(candidate);
    if (!checked.input) { setErrors(checked.errors); return; }
    const nextValue = "birthdate" in checked.input ? checked.input.birthdate : checked.input.pays;
    if (nextValue === profile[field]) { setSuccess("Aucune modification à enregistrer."); return; }

    setSaving(field);
    try {
      const response = await fetch("/api/auth/profile/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Chatnet-Profile-Nickname": profile.nickname },
        body: JSON.stringify(checked.input),
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status === 401) {
        await refreshUser(true);
        router.replace("/connexion");
        return;
      }
      if (response.status === 409) {
        await refreshUser();
        setMessage("La session a changé. Rechargez le profil.");
        return;
      }
      if (response.status === 422) {
        const data: { errors?: ProfileUpdateErrors } = await response.json().catch(() => ({}));
        setErrors({ [field]: data.errors?.[field] || "Vérifiez ce champ." });
        return;
      }
      if (!response.ok) {
        setMessage(response.status === 429 ? "Trop de tentatives. Réessayez plus tard." : "Mise à jour indisponible. Rechargez le profil si la modification a été enregistrée.");
        return;
      }
      const data: { profile?: OwnProfile } = await response.json();
      const updated = data.profile;
      if (!updated || updated.nickname !== profile.nickname || typeof updated[field] !== "string") throw new Error("Invalid profile response");
      onSaved(updated);
      if (field === "birthdate") setBirthdate(updated.birthdate ?? "");
      else setPays(updated.pays ?? "");
      await refreshUser();
      setSuccess(field === "birthdate" ? "Date de naissance mise à jour." : "Pays mis à jour.");
    } catch { setMessage("Mise à jour indisponible. Rechargez le profil si la modification a été enregistrée."); }
    finally { setSaving(null); }
  }

  return <section className="profile-edit-panel" aria-label="Modifier mon profil">
    <h3>Modifier mon profil</h3>
    <p>Enregistrez chaque champ séparément.</p>
    <div className="profile-edit-grid">
      <div className="chat-join-field">
        <label htmlFor="profile-edit-birthdate">Date de naissance</label>
        <input id="profile-edit-birthdate" name="birthdate" type="date" autoComplete="bday" value={birthdate} onChange={(event) => { setBirthdate(event.target.value); setErrors((current) => ({ ...current, birthdate: undefined })); }} aria-invalid={Boolean(errors.birthdate)} aria-describedby={errors.birthdate ? "profile-edit-birthdate-error" : undefined} disabled={Boolean(saving)} required />
        {errors.birthdate && <span className="field-error" id="profile-edit-birthdate-error">{errors.birthdate}</span>}
        <button type="button" className="button button-primary" onClick={() => save("birthdate")} disabled={Boolean(saving)}>{saving === "birthdate" ? "Enregistrement…" : "Enregistrer la date"}</button>
      </div>
      <div className="chat-join-field">
        <label htmlFor="profile-edit-pays">Pays</label>
        <select id="profile-edit-pays" name="pays" autoComplete="country-name" value={pays} onChange={(event) => { setPays(event.target.value); setErrors((current) => ({ ...current, pays: undefined })); }} aria-invalid={Boolean(errors.pays)} aria-describedby={errors.pays ? "profile-edit-pays-error" : undefined} disabled={Boolean(saving)} required>
          <option value="">Choisissez votre pays</option>
          {profile.pays && !registrationCountrySet.has(profile.pays) && <option value={profile.pays}>{profile.pays}</option>}
          {sortedCountries.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        {errors.pays && <span className="field-error" id="profile-edit-pays-error">{errors.pays}</span>}
        <button type="button" className="button button-primary" onClick={() => save("pays")} disabled={Boolean(saving)}>{saving === "pays" ? "Enregistrement…" : "Enregistrer le pays"}</button>
      </div>
    </div>
    {message && <p className="chat-join-error" role="alert">{message}</p>}
    {success && <p className="profile-avatar-success" role="status">{success}</p>}
    <button type="button" className="button button-outline profile-edit-close" onClick={onCancel} disabled={Boolean(saving)}>Terminer</button>
  </section>;
}
