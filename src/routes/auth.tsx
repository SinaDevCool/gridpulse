import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { CheckCircle2, LoaderCircle, LockKeyhole } from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { isFinderMvp } from "@/config/product-mode";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect:
      typeof search.redirect === "string" &&
      search.redirect.startsWith("/") &&
      !search.redirect.startsWith("//")
        ? search.redirect
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Access Your GridPulse Workspace" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect: requestedRedirect } = Route.useSearch();
  const redirect = requestedRedirect ?? "/portfolio";
  const { user, loading: sessionLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    trackEvent("auth_submit_started", { mode });
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth?redirect=${encodeURIComponent(redirect)}`,
            },
          });
    setBusy(false);
    if (result.error) {
      setError(`${result.error.message} Check your details and try again.`);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setNotice("Check your email and confirm your account, then return here to sign in.");
      return;
    }
    window.location.assign(redirect);
  }

  return (
    <PublicLayout>
      <main id="main-content" className="auth-page auth-boundary-page">
        {!sessionLoading && user ? (
          <div className="auth-card">
            <CheckCircle2 className="auth-success" aria-hidden="true" />
            <p className="context-label">Private Workspace</p>
            <h1>You are signed in.</h1>
            <p>{user.email}</p>
            <div className="auth-entry-actions">
              <Link to="/portfolio" className="primary-button">
                Open Portfolio
              </Link>
              <Link to="/assessments/new" className="back-link">
                Create a New Project
              </Link>
            </div>
          </div>
        ) : (
          <div className="auth-card">
            <span className="auth-icon">
              <LockKeyhole aria-hidden="true" />
            </span>
            <p className="context-label">Private GridPulse Workspace</p>
            <h1>{mode === "signin" ? "Access your workspace." : "Activate your workspace."}</h1>
            <p>
              {mode === "signin"
                ? "Sign in to access private connection projects and evidence."
                : "Use the email associated with your GridPulse pilot or workspace invitation."}
            </p>
            <div className="auth-tabs" role="tablist" aria-label="Workspace access mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                className={mode === "signin" ? "active" : ""}
                onClick={() => setMode("signin")}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                className={mode === "signup" ? "active" : ""}
                onClick={() => setMode("signup")}
              >
                Activate Account
              </button>
            </div>
            <form onSubmit={submit}>
              <label>
                Email Address
                <input name="email" type="email" autoComplete="email" spellCheck={false} required />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  minLength={8}
                  required
                />
              </label>
              {error ? (
                <div className="form-message error-message" aria-live="polite">
                  {error}
                </div>
              ) : null}
              {notice ? (
                <div className="form-message success-message" aria-live="polite">
                  {notice}
                </div>
              ) : null}
              <button type="submit" className="primary-button auth-submit" disabled={busy}>
                {busy ? (
                  <>
                    <LoaderCircle className="spin" aria-hidden="true" /> Please Wait…
                  </>
                ) : mode === "signin" ? (
                  "Sign In"
                ) : (
                  "Activate Account"
                )}
              </button>
            </form>
            <div className="auth-pilot-route">
              <span>{isFinderMvp() ? "Need to evaluate a location first?" : "Not yet a customer?"}</span>
              {isFinderMvp() ? <Link to="/power-finder">Open Power Finder</Link> : <Link to="/pilot">Request a Pilot</Link>}
            </div>
            <small>GridPulse workspaces contain private project and evidence records.</small>
          </div>
        )}
      </main>
    </PublicLayout>
  );
}
