import "server-only";

import { cache } from "react";

import { fetchApi, isRecord, logApiFailure } from "@/lib/api/client.server";
import type { PublicRoom, PublicRoomResult, PublicRoomsResult, RawChannel } from "@/lib/api/types";
import { normalizeRoomName, normalizeRoomRouteParam, sameRoomName } from "@/lib/rooms";

export function normalizeRoom(value: unknown): PublicRoom | null {
  if (!isRecord(value)) return null;
  const raw: RawChannel = value;
  if (!normalizeRoomName(raw.channel) || typeof raw.channel !== "string") return null;

  return {
    name: raw.channel.trim(),
    topic: typeof raw.topic === "string" && raw.topic.trim() ? raw.topic.trim() : null,
  };
}

export const getPublicRoomsResult = cache(async (): Promise<PublicRoomsResult> => {
  try {
    const response = await fetchApi("/api/channels");
    if (!Array.isArray(response)) throw new Error("Invalid channel list");

    const rooms = response.map(normalizeRoom);
    if (rooms.some((room) => room === null)) throw new Error("Invalid channel in list");
    return { status: "available", rooms: rooms as PublicRoom[] };
  } catch (error) {
    logApiFailure("channels", error);
    return { status: "unavailable" };
  }
});

export const getPublicRoom = cache(async (value: string): Promise<PublicRoomResult> => {
  const name = normalizeRoomRouteParam(value);
  if (!name) return { status: "not-found" };
  const result = await getPublicRoomsResult();
  if (result.status === "unavailable") return result;
  const matches = result.rooms.filter((room) => sameRoomName(name, room.name));
  if (matches.length > 1) return { status: "unavailable" };
  return matches.length ? { status: "found", room: matches[0] } : { status: "not-found" };
});
