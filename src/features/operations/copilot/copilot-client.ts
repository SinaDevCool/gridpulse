import { supabase } from "@/integrations/supabase/client";
import { publicMilpClient, publicMilpEnabled } from "@/lib/public-milp-session";

/** Shared session/transport for brief and conversation. Secrets remain server-side. */
export async function requestCopilot(path: "brief" | "conversation", body: unknown, signal: AbortSignal) {
  const { data: { session } } = await (publicMilpEnabled() ? publicMilpClient() : supabase).auth.getSession();
  signal.throwIfAborted();
  if (!session) throw new Error("Run a calculation to establish a session first.");
  const response = await fetch(`/api/operations/${path}`, { method: "POST", signal,
    headers: { "content-type": "application/json", "x-gridpulse-capabilities": "verified-findings-v2", authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body) });
  const raw = await response.json();
  if (!response.ok) throw new Error(raw.error ?? "Explanation unavailable.");
  return raw;
}
