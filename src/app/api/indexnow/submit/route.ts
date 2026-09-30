import { submitIndexNowRequest } from "../../../../lib/seo/indexnow.server.ts";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return submitIndexNowRequest(request);
}
