import { NextRequest, NextResponse } from "next/server";
import { upstreamCookieHeader } from "@/lib/auth/cookies.server";
import { csrfCookies, fetchLaravel, xsrfHeader } from "@/lib/auth/laravel.server";
import { hasTrustedOrigin } from "@/lib/auth/origin.server";
import { registrationFailure, validateRegistration } from "@/lib/auth/registration";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
const maxBytes = 4096;

function error(status: number, code: string, message: string, errors?: Record<string, string>) {
  return NextResponse.json({ code, message, ...(errors && Object.keys(errors).length ? { errors } : {}) }, { status, headers: noStore });
}

async function readLimitedJson(request: NextRequest): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new Error("Input too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Empty input");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("Input too large");
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return error(403, "UNTRUSTED_ORIGIN", "Origine non autorisée.");
  let value: unknown;
  try { value = await readLimitedJson(request); }
  catch { return error(400, "INVALID_INPUT", "Requête invalide."); }
  const { input, errors } = validateRegistration(value);
  if (!input) return error(422, "INVALID_INPUT", "Vérifiez les champs du formulaire.", errors);

  try {
    const cookies = await csrfCookies();
    const xsrf = cookies && xsrfHeader(cookies);
    if (!cookies || !xsrf) return error(503, "UNAVAILABLE", "Inscription temporairement indisponible.");
    const upstream = await fetchLaravel("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: upstreamCookieHeader(cookies), "X-XSRF-TOKEN": xsrf },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(20000),
    });
    if (upstream.status !== 201) {
      const body = upstream.status === 422 || upstream.status === 409 ? await upstream.json().catch(() => null) : null;
      const failure = registrationFailure(upstream.status, body);
      return error(failure.status, failure.code, failure.message, failure.errors);
    }
    // Laravel registration creates an account but does not establish an authenticated session.
    return NextResponse.json({ success: true }, { status: 201, headers: noStore });
  } catch {
    return error(503, "UNAVAILABLE", "Inscription temporairement indisponible.");
  }
}
