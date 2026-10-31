import { NextRequest } from "next/server";
import { handleChannelRequests } from "@/lib/channels/requests.server";

export const runtime = "nodejs";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleChannelRequests(request, "PUT", id);
}
