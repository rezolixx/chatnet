import "server-only";

const DEFAULT_API_BASE_URL = "https://laravel.discut.org";
const REVALIDATE_SECONDS = 60;
const TIMEOUT_MS = 4000;

export function apiBaseUrl(): string {
  const configured = process.env.API_BASE_URL?.trim();
  if (!configured) return DEFAULT_API_BASE_URL;

  const url = new URL(configured);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("API_BASE_URL must use HTTPS (or HTTP on localhost)");
  }
  return url.origin;
}

export async function fetchApi(path: string, revalidateSeconds = REVALIDATE_SECONDS): Promise<unknown> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    headers: { Accept: "application/json" },
    ...(revalidateSeconds === 0 ? { cache: "no-store" as const } : { next: { revalidate: revalidateSeconds } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}

export function logApiFailure(dataset: string, error: unknown): void {
  const reason = error instanceof Error ? error.message : "Unknown error";
  console.warn(`[Chatnet API] ${dataset} unavailable: ${reason}`);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
