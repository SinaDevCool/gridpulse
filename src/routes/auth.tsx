import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, LoaderCircle, LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
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
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth` },
          });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setNotice("Check your email and confirm your account, then return here to sign in.");
      return;
    }
    await navigate({ to: "/portfolio" });
  }

  if (!sessionLoading && user)
    return (
      <main id="main-content" className="auth-page">
        <div className="auth-card">
          <CheckCircle2 className="auth-success" />
          <h1>You are signed in</h1>
          <p>{user.email}</p>
          <Link to="/portfolio" className="primary-button">
            Open portfolio
          </Link>
        </div>
      </main>
    );

  return (
    <main id="main-content" className="auth-page">
      <div className="auth-card">
        <Link to="/" className="back-link">
          <ArrowLeft /> Back to GridPulse
        </Link>
        <span className="auth-icon">
          <LockKeyhole />
        </span>
        <p className="context-label">GridPulse Connect</p>
        <h1>{mode === "signin" ? "Welcome back" : "Create your workspace"}</h1>
        <p>
          {mode === "signin"
            ? "Sign in to access private connection projects and evidence."
            : "Start a private, evidence-led connection project workspace."}
        </p>
        <div className="auth-tabs">
          <button className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>
            Sign in
          </button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
            Create account
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            Email address
            <input name="email" type="email" autoComplete="email" required />
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
          {error ? <div className="form-message error-message">{error}</div> : null}
          {notice ? <div className="form-message success-message">{notice}</div> : null}
          <button className="primary-button auth-submit" disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle className="spin" />
                Please wait
              </>
            ) : mode === "signin" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </button>
        </form>
        <small>
          By continuing, you agree to use GridPulse for preliminary decision support only.
        </small>
      </div>
    </main>
  );
}
