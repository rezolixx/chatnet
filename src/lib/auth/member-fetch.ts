import { readAccountRefusal, type AccountRefusal } from "./account-restriction.ts";

// Browser fetch for the member BFF routes (/api/auth/...). A Ban /
// Suspension refusal, or an unreadable restriction state, is announced to
// the AuthProvider, which clears the member state and shows the site-wide
// notice; the caller still gets the response and stops its own flow.
type Listener = (refusal: AccountRefusal) => void;

const listeners = new Set<Listener>();

export function onAccountRefusal(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export async function memberFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  const refusal = await readAccountRefusal(response);
  if (refusal) for (const listener of listeners) listener(refusal);
  return response;
}
