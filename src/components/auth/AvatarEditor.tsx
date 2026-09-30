"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MemberAvatar } from "@/components/community/MemberAvatar";
import { avatarValidationError } from "@/lib/auth/avatar";
import { useAuth } from "./AuthProvider";

export function AvatarEditor({ nickname, avatar, onUploaded }: { nickname: string; avatar: string | null; onUploaded: (avatar: string) => void }) {
  const router = useRouter();
  const { refreshUser, updateAvatar } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function selectFile(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setError("");
    setSuccess("");
    const validation = avatarValidationError(selected);
    if (validation) {
      setFile(null);
      setPreview(null);
      setError(validation);
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected!));
  }

  function cancelSelection() {
    setFile(null);
    setPreview(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function upload() {
    if (!file || uploading) return;
    setUploading(true);
    setError("");
    const body = new FormData();
    body.set("avatar", file);
    try {
      const response = await fetch("/api/auth/avatar", { method: "POST", body, credentials: "same-origin", cache: "no-store" });
      if (response.status === 401) {
        await refreshUser(true);
        router.replace("/connexion");
        return;
      }
      if (!response.ok) {
        if (response.status === 413 || response.status === 422) setError("L’image doit être au format JPEG, PNG, GIF ou WebP et faire au maximum 4 Mo.");
        else if (response.status === 429) setError("Trop de tentatives. Réessayez plus tard.");
        else setError("Envoi temporairement indisponible. Réessayez.");
        return;
      }
      const result: unknown = await response.json();
      if (!result || typeof result !== "object" || !("avatar" in result) || typeof result.avatar !== "string") throw new Error("Invalid upload response");
      onUploaded(result.avatar);
      updateAvatar(nickname, result.avatar);
      cancelSelection();
      setSuccess("Votre photo a été mise à jour.");
      void refreshUser();
    } catch { setError("Envoi temporairement indisponible. Réessayez."); }
    finally { setUploading(false); }
  }

  return <div className="profile-avatar-editor">
    <MemberAvatar member={{ nickname, avatar: preview ?? avatar }} />
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={selectFile} hidden aria-label="Choisir une photo de profil" />
    <button type="button" className="profile-avatar-change" onClick={() => inputRef.current?.click()} disabled={uploading}>Changer la photo</button>
    {file && <div className="profile-avatar-actions"><button type="button" className="button button-primary" onClick={upload} disabled={uploading}>{uploading ? "Envoi en cours…" : "Enregistrer la photo"}</button><button type="button" className="button button-outline" onClick={cancelSelection} disabled={uploading}>Annuler</button></div>}
    {error && <p className="profile-avatar-error" role="alert">{error}</p>}
    {success && <p className="profile-avatar-success" role="status">{success}</p>}
  </div>;
}
