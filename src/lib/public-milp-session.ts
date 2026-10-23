import { createClient } from "@supabase/supabase-js";

type VisitorSession = { access_token: string; user: { is_anonymous?: boolean } };
type VisitorAuth = {
  getSession: () => Promise<{ data: { session: VisitorSession | null }; error?: unknown }>;
  signInAnonymously: () => Promise<{
    data: { session: VisitorSession | null }; error: { message: string } | null;
  }>;
};

let client: ReturnType<typeof createClient> | undefined;
export const publicMilpEnabled = () => import.meta.env.VITE_PUBLIC_MILP_ENABLED === "true";

/** Separate SDK storage namespace prevents replacing an existing named-user login. */
export function publicMilpClient() {
  if (typeof window === "undefined") throw new Error("Public MILP sessions are browser-only");
  if (!client) client = createClient(import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: { storageKey: "gridpulse-public-milp-session", persistSession: true, autoRefreshToken: true },
    });
  return client;
}

function restricted(session: VisitorSession | null): session is VisitorSession {
  if (!session?.user.is_anonymous) return false;
  try {
    const encoded = session.access_token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    // UI readiness only. The API still verifies the token with Supabase.
    return JSON.parse(atob(encoded + "=".repeat((4 - encoded.length % 4) % 4))).role === "gridpulse_public_visitor";
  } catch { return false; }
}

/** Invoke only after explicit Run, never on page load. No CAPTCHA is required. */
export async function ensureVisitorSession(auth: VisitorAuth) {
  const existing = await auth.getSession();
  if (existing.error) throw new Error("Unable to load the public visitor session");
  if (existing.data.session) {
    if (!restricted(existing.data.session)) throw new Error("A restricted public visitor session is required");
    return existing.data.session;
  }
  const result = await auth.signInAnonymously();
  if (result.error || !restricted(result.data.session))
    throw new Error("A restricted public session could not be created. Please retry later.");
  return result.data.session;
}
