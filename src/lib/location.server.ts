import "server-only";

const countryNames = new Intl.DisplayNames(["fr"], { type: "region" });

function safePart(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const part = value.trim();
  return part && part.length <= 80 && !/[\u0000-\u001f\u007f]/.test(part) ? part : null;
}

export function cloudflareLocation(headers: Headers): string | null {
  const code = headers.get("cf-ipcountry")?.trim().toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return null;

  const country = countryNames.of(code);
  if (!country || country === code) return null;
  const city = safePart(headers.get("cf-ipcity"));
  return city ? `${city}, ${country}` : country;
}

export async function developmentLocation(): Promise<string | null> {
  try {
    // One server-side lookup of the development machine's public egress IP.
    const response = await fetch("https://ipapi.co/json/", {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const result = data as Record<string, unknown>;
    if (result.error === true) return null;

    const code = safePart(result.country_code)?.toUpperCase();
    const translated = code && /^[A-Z]{2}$/.test(code) ? countryNames.of(code) : null;
    const country = translated && translated !== code ? translated : safePart(result.country_name);
    if (!country) return null;
    const city = safePart(result.city);
    return city ? `${city}, ${country}` : country;
  } catch {
    return null;
  }
}
