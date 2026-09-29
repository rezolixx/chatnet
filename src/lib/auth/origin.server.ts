import "server-only";

import type { NextRequest } from "next/server";

const productionOrigins = new Set(["https://chatnet.fr", "https://www.chatnet.fr"]);

export function hasTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  if (productionOrigins.has(origin)) return true;
  return process.env.NODE_ENV !== "production" && origin === "http://localhost:3000";
}
