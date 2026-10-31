import { NextRequest } from "next/server";
import { handleChannelRequests } from "@/lib/channels/requests.server";

export const runtime = "nodejs";

export function GET(request: NextRequest) { return handleChannelRequests(request, "GET"); }
export function POST(request: NextRequest) { return handleChannelRequests(request, "POST"); }
