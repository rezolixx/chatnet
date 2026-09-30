import { indexNowKeyResponse } from "../../lib/seo/indexnow.server.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return indexNowKeyResponse();
}
