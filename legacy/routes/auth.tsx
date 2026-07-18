import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

const authSearchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["signin", "signup", "reset"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (input) => authSearchSchema.parse(input),
  head: () => ({
    meta: [
      { title: "Sign in — GridPulse" },
      { name: "description", content: "Sign in or create an account to access GridPulse." },
    ],
  }),
  component: AuthPage,
});

function sanitizeRedirect(raw: string | undefined): string {
  if (!raw) return "/dashboard";
  // Only allow same-origin absolute paths
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const redirectTo = sanitizeRedirect(search.redirect);
  const [mode, setMode] = useState<"signin" | "signup" | "reset">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  // Redirect away if already signed in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirectTo, replace: true });
    });
  }, [navigate, redirectTo]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "reset") {
      if (!email) {
        toast.error("Enter your email to reset your password.");
        return;
      }
      setBusy(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset email sent. Check your inbox.");
        setMode("signin");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Reset failed.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!email || !pwd) {
      toast.error("Email and password are required.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password: pwd,
          options: {
            emailRedirectTo: `${window.location.origin}${redirectTo}`,
            data: { name },
          },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in.");
        navigate({ to: redirectTo, replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
        if (error) throw error;
        toast.success("Welcome back.");
        navigate({ to: redirectTo, replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + redirectTo,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: redirectTo, replace: true });
  }

  const title =
    mode === "reset" ? "Reset your password" : mode === "signin" ? "Welcome back" : "Create your account";
  const subtitle =
    mode === "reset"
      ? "We'll email you a link to set a new password."
      : mode === "signin"
        ? "Sign in to GridPulse."
        : "Start your free GridPulse account.";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-16 lg:px-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

        {mode !== "reset" && (
          <div className="mt-6 flex rounded-md border border-border bg-surface/40 p-1 text-sm">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded px-3 py-1.5 cursor-pointer ${mode === m ? "bg-cyan-accent text-primary-foreground" : "text-muted-foreground"}`}
              >
                {m === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>
        )}

        {mode !== "reset" && (
          <>
            <button
              onClick={googleSignIn}
              disabled={busy}
              className="mt-6 w-full rounded-md border border-border bg-surface/60 px-4 py-2.5 text-sm hover:border-cyan-accent/40 cursor-pointer disabled:opacity-50"
            >
              Continue with Google
            </button>

            <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> or email <div className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name (optional)"
              className="w-full rounded-md border border-border bg-background/60 px-3 py-2.5 text-sm focus:border-cyan-accent focus:outline-none"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@utility.com"
            className="w-full rounded-md border border-border bg-background/60 px-3 py-2.5 text-sm focus:border-cyan-accent focus:outline-none"
          />
          {mode !== "reset" && (
            <input
              type="password"
              required
              minLength={6}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Password (min 6 characters)"
              className="w-full rounded-md border border-border bg-background/60 px-3 py-2.5 text-sm focus:border-cyan-accent focus:outline-none"
            />
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-cyan-accent px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 cursor-pointer disabled:opacity-50"
          >
            {busy
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send reset link"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs">
          {mode === "signin" ? (
            <button
              type="button"
              onClick={() => setMode("reset")}
              className="text-muted-foreground hover:text-cyan-accent"
            >
              Forgot password?
            </button>
          ) : mode === "reset" ? (
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="text-muted-foreground hover:text-cyan-accent"
            >
              ← Back to sign in
            </button>
          ) : (
            <span />
          )}
          <Link to="/subscribe" className="text-cyan-accent hover:underline">
            See plans →
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
