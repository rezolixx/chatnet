import { createHash, timingSafeEqual } from "node:crypto";
import { site } from "../site.ts";
import { indexablePaths } from "./indexable.ts";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const KEY_LOCATION = `${site.url}/indexnow-key.txt`;
const noStore = { "Cache-Control": "no-store" };

function configuredKey(): string | null {
  const key = process.env.INDEXNOW_KEY;
  return key && key.match(/^[A-Za-z0-9-]{8,128}$/)?.[0] === key ? key : null;
}

function configuredTriggerSecret(): string | null {
  const secret = process.env.INDEXNOW_TRIGGER_SECRET;
  return secret?.trim() ? secret : null;
}

function tokenMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const actualHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function errorResponse(status: number, code: string): Response {
  return Response.json({ ok: false, code }, { status, headers: noStore });
}

export function indexNowKeyResponse(): Response {
  const key = configuredKey();
  if (!key) return new Response(null, { status: 404, headers: noStore });
  return new Response(key, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}

export async function submitIndexNowRequest(request: Request): Promise<Response> {
  const key = configuredKey();
  const secret = configuredTriggerSecret();
  if (!key || !secret) return errorResponse(503, "UNAVAILABLE");
  if (!tokenMatches(request.headers.get("X-IndexNow-Token"), secret)) return errorResponse(401, "UNAUTHORIZED");

  const origin = new URL(site.url);
  if (origin.origin !== "https://chatnet.fr") return errorResponse(503, "UNAVAILABLE");
  const urlList = indexablePaths.map((path) => `${site.url}${path}`);

  try {
    const upstream = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ host: origin.host, key, keyLocation: KEY_LOCATION, urlList }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!upstream.ok) return errorResponse(upstream.status === 429 ? 503 : 502, "UPSTREAM_UNAVAILABLE");
    return Response.json({ ok: true, submitted: urlList.length }, { headers: noStore });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return errorResponse(timedOut ? 504 : 502, "UPSTREAM_UNAVAILABLE");
  }
}
