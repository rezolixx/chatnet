import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRoomName, normalizeRoomRouteParam, publicRoomHref, roomJoinName, sameRoomName } from "../src/lib/rooms.ts";
import { buildChatUrl, buildAuthenticatedChatUrl } from "../src/lib/chat.ts";
import { publicMemberModules } from "./helpers/public-member.mjs";

const list = [{ channel: "#Radio", topic: "Un sujet", chanid: 4, modes: "+nt", topicauthor: "private" }, { channel: "music", topic: "" }];
const json = (value) => new Response(JSON.stringify(value));
function api(response = json(list)) {
  const calls = [];
  const modules = publicMemberModules(async (url, init) => {
    calls.push({ url, init });
    if (response instanceof Error) throw response;
    return response.clone();
  });
  return { ...modules.load("lib/api/rooms.server.ts"), calls, modules };
}
const plain = (value) => JSON.parse(JSON.stringify(value));

test("room names and public paths normalize hash/case and decode Next params exactly once", () => {
  assert.equal(normalizeRoomName(" #Radio "), "Radio");
  assert.equal(sameRoomName("radio", "#Radio"), true);
  for (const name of ["#Radio", "café", "a&b", "a?b", "a[b]", "a%23b", "a#b"]) {
    const path = publicRoomHref(name);
    const nextParam = path.slice("/salons/".length);
    assert.equal(normalizeRoomRouteParam(nextParam), normalizeRoomName(name));
    assert.equal(new URL(path, "https://chatnet.fr").search, "");
    assert.equal(new URL(path, "https://chatnet.fr").hash, "");
    assert.doesNotMatch(path, /token=|ticket=|nick=/);
  }
  assert.equal(publicRoomHref("#radio"), "/salons/radio");
  assert.equal(normalizeRoomRouteParam("a%2523b"), "a%23b");
  assert.equal(sameRoomName("a%23b", "a#b"), false);
  for (const malformed of ["%", "%GG", "%E0%A4%A", "%0aJOIN"]) assert.equal(normalizeRoomRouteParam(malformed), null);
});

test("unsafe room/path inputs cannot construct a detail or IRC command", () => {
  for (const value of [null, [], {}, "", "#", "##radio", ".", "..", "a/b", "a\\b", "a,b", "a b", "a\nJOIN", "a\rJOIN", "a\0b", "a:b", "\ud800"]) {
    assert.equal(normalizeRoomRouteParam(value), null, String(value));
    assert.equal(publicRoomHref(value), "/salons");
    assert.equal(roomJoinName(value), null);
  }
});

test("public list keeps only name/topic and preserves anonymous cache/timeout behavior", async () => {
  const h = api();
  assert.deepEqual(plain(await h.getPublicRoomsResult()), { status: "available", rooms: [{ name: "#Radio", topic: "Un sujet" }, { name: "music", topic: null }] });
  assert.equal(h.calls[0].url, "https://laravel.discut.org/api/channels");
  assert.equal(h.calls[0].init.next.revalidate, 60);
  assert.equal(h.calls[0].init.headers.Accept, "application/json");
  assert.equal(h.calls[0].init.headers.Cookie, undefined);
  assert.equal(h.calls[0].init.headers.Authorization, undefined);
  assert.ok(h.calls[0].init.signal instanceof AbortSignal);
});

test("room resolution requires a list match, accepts hash/case, and only calls the list", async () => {
  for (const name of ["Radio", "radio", "#Radio", "%23Radio"]) {
    const h = api();
    assert.deepEqual(plain(await h.getPublicRoom(name)), { status: "found", room: { name: "#Radio", topic: "Un sujet" } });
    assert.ok(h.calls.every(({ url }) => new URL(url).pathname === "/api/channels"));
  }
  assert.equal((await api().getPublicRoom("unknown")).status, "not-found");
  const h = api();
  assert.equal((await h.getPublicRoom("../radio")).status, "not-found");
  assert.equal(h.calls.length, 0);
  assert.equal((await api(json([{ channel: "#café", topic: null }])).getPublicRoom("caf%C3%A9")).status, "found");
  const escaped = api(json([{ channel: "#a%23b" }, { channel: "#a#b" }]));
  assert.equal((await escaped.getPublicRoom("a%2523b")).room.name, "#a%23b");
  assert.equal((await escaped.getPublicRoom("a%23b")).room.name, "#a#b");
});

test("empty is distinct from failure; invalid/partial lists, timeouts and ambiguous matches never become 404", async () => {
  assert.deepEqual(plain(await api(json([])).getPublicRoomsResult()), { status: "available", rooms: [] });
  assert.equal((await api(json([])).getPublicRoom("radio")).status, "not-found");
  for (const response of [new Error("timeout"), new DOMException("Timed out", "TimeoutError"), new Response("private", { status: 500 }), json({ data: list }), new Response("bad JSON"), json([null]), json([...list, { channel: 1 }])]) {
    assert.deepEqual(plain(await api(response).getPublicRoomsResult()), { status: "unavailable" });
    assert.deepEqual(plain(await api(response).getPublicRoom("radio")), { status: "unavailable" });
  }
  assert.equal((await api(json([{ channel: "#Radio" }, { channel: "radio" }])).getPublicRoom("radio")).status, "unavailable");
});

test("guest/member URLs retain defaults and transmit supported selected fragments unchanged", () => {
  const details = { nick: "Member", age: "25", sexe: "F", ville: "Paris" };
  assert.equal(new URL(buildChatUrl(details, "ticket")).hash, "#Accueil");
  assert.equal(new URL(buildAuthenticatedChatUrl(details, "token")).hash, "#Accueil");
  for (const room of ["#Radio", "a&b", "a?b", "a[b]", "a%23b", "a#b"]) {
    const guest = new URL(buildChatUrl(details, "ticket", room));
    const member = new URL(buildAuthenticatedChatUrl(details, "token", "ticket", room));
    assert.equal(guest.hash, `#${normalizeRoomName(room)}`);
    assert.equal(member.hash, guest.hash);
    assert.equal(guest.searchParams.get("chatnow"), "1");
    assert.equal(member.searchParams.get("chatnow"), "1");
    assert.equal(guest.searchParams.get("token"), null);
    assert.equal(member.searchParams.get("token"), "token");
  }
  // Existing WebChat never decodes these escapes: do not silently join %C3%A9.
  for (const room of ["café", 'a"b', "a<b", "a`b", "a b", "a\nJOIN"]) {
    assert.equal(roomJoinName(room), null);
    assert.throws(() => buildChatUrl(details, "ticket", room), /Unsupported room fragment/);
    assert.throws(() => buildAuthenticatedChatUrl(details, "token", undefined, room), /Unsupported room fragment/);
  }
});
