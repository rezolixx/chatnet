export const dynamic = "force-dynamic";

import { cloudflareLocation, developmentLocation } from "@/lib/location.server";

export async function GET(request: Request) {
  let location = cloudflareLocation(request.headers);
  if (process.env.NODE_ENV === "development" && process.env.DEV_LOCATION_FALLBACK === "ipapi" && !request.headers.has("cf-ipcountry") && !request.headers.has("cf-ipcity")) {
    location = await developmentLocation();
  }

  return Response.json({ location }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
