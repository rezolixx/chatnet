import { NextRequest, NextResponse } from "next/server";
import { completeUpstreamCookies, mergeUpstreamCookies, setBridgeCookies, upstreamCookieHeader } from "@/lib/auth/cookies.server";
import { csrfCookies, fetchLaravel, laravelMe, projectSafeUser, xsrfHeader } from "@/lib/auth/laravel.server";
import { hasTrustedOrigin } from "@/lib/auth/origin.server";
import type { AuthErrorCode } from "@/lib/auth/types";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

function error(status: number, code: AuthErrorCode, message: string) {
  return NextResponse.json({ code, message }, { status, headers: noStore });
}

async function readLimitedJson(request: NextRequest): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > 4096) throw new Error("Input too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Empty input");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) throw new Error("Input too large");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return error(403, "AUTH_REQUIRED", "Origine non autorisée.");

  let input: unknown;
  try { input = await readLimitedJson(request); }
  catch { return error(400, "INVALID_INPUT", "Requête invalide."); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return error(400, "INVALID_INPUT", "Requête invalide.");
  const fields = input as Record<string, unknown>;
  const login = typeof fields.login === "string" ? fields.login.trim() : "";
  const password = fields.password;
  if (!login || login.length > 320 || typeof password !== "string" || !password || password.length > 1024) {
    return error(400, "INVALID_INPUT", "Renseignez votre pseudo ou e-mail et votre mot de passe.");
  }

  try {
    const initial = await csrfCookies();
    if (!initial) return error(503, "UNAVAILABLE", "Connexion temporairement indisponible.");
    const xsrf = xsrfHeader(initial);
    if (!xsrf) return error(503, "UNAVAILABLE", "Connexion temporairement indisponible.");

    const loginResponse = await fetchLaravel("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-XSRF-TOKEN": xsrf,
        Cookie: upstreamCookieHeader(initial),
      },
      body: JSON.stringify({ login, password }),
    });
    if (loginResponse.status === 422 || loginResponse.status === 401 || loginResponse.status === 403) {
      return error(401, "INVALID_CREDENTIALS", "Identifiants incorrects.");
    }
    if (loginResponse.status === 429) return error(429, "RATE_LIMITED", "Trop de tentatives. Réessayez plus tard.");
    if (loginResponse.status === 419) return error(419, "SESSION_EXPIRED", "Session expirée. Réessayez.");
    if (!loginResponse.ok) return error(503, "UNAVAILABLE", "Connexion temporairement indisponible.");

    const finalCookies = completeUpstreamCookies(mergeUpstreamCookies(initial, loginResponse.headers));
    if (!finalCookies) return error(503, "UNAVAILABLE", "Connexion temporairement indisponible.");
    const verified = await laravelMe(finalCookies);
    if (!verified.response.ok) return error(401, "INVALID_CREDENTIALS", "Connexion impossible. Réessayez.");
    const user = projectSafeUser(await verified.response.json());
    if (!user) return error(503, "UNAVAILABLE", "Connexion temporairement indisponible.");

    const response = NextResponse.json({ user }, { headers: noStore });
    setBridgeCookies(response, verified.cookies);
    return response;
  } catch {
    return error(503, "UNAVAILABLE", "Connexion temporairement indisponible.");
  }
}
