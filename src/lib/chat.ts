export const ORIGIN_TICKET_URL = "https://laravel.discut.org/api/chat/origin-ticket";
export const CHAT_URL = "https://chat.discut.org/chat";

export type ChatJoinDetails = {
  nick: string;
  age: string;
  sexe: "M" | "F";
  ville: string;
};

export function buildChatUrl(details: ChatJoinDetails, ticket: string): string {
  const url = new URL(CHAT_URL);
  url.searchParams.set("nick", details.nick);
  url.searchParams.set("age", details.age);
  url.searchParams.set("sexe", details.sexe);
  url.searchParams.set("ville", details.ville);
  url.searchParams.set("chatnow", "1");
  url.searchParams.set("ticket", ticket);
  url.hash = "Accueil";
  return url.toString();
}
