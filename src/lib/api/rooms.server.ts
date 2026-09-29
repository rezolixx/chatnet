import "server-only";

import { fetchApi, isRecord, logApiFailure } from "@/lib/api/client.server";
import type { PublicRoom, RawChannel, RawChannelResponse } from "@/lib/api/types";

export function normalizeRoom(value: unknown): PublicRoom | null {
  if (!isRecord(value)) return null;
  const raw: RawChannel = value;
  if (typeof raw.channel !== "string" || !raw.channel.trim()) return null;

  return {
    name: raw.channel.trim(),
    topic: typeof raw.topic === "string" && raw.topic.trim() ? raw.topic.trim() : null,
  };
}

export async function getPublicRooms(): Promise<PublicRoom[]> {
  try {
    const response = await fetchApi("/api/channels");
    if (!Array.isArray(response)) throw new Error("Invalid channel list");

    const channels: RawChannelResponse = response;
    const rooms = channels.map(normalizeRoom).filter((room): room is PublicRoom => room !== null);
    if (channels.length > 0 && rooms.length === 0) throw new Error("No valid channels in list");
    return rooms;
  } catch (error) {
    logApiFailure("channels", error);
    return [];
  }
}
