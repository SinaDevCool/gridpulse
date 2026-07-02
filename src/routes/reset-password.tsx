import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — GridPulse" },
      { name: "description", content: "Set a new password for your GridPulse account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash into a session automatically.
    // Confirm we have one before showing the form.
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        toast.error("Password reset link is invalid or expired. Request a new one.");
        navigate({ to: "/auth", search: { mode: "reset" }, replace: true });
        return;
      }
      setReady(true);
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (pwd !== pwd2) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-16 lg:px-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Set a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a strong password you don't use elsewhere.
        </p>
        {!ready ? (
          <div className="mt-8 text-sm text-muted-foreground">Verifying reset link…</div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              type="password"
              required
              minLength={6}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="New password"
              className="w-full rounded-md border border-border bg-background/60 px-3 py-2.5 text-sm focus:border-cyan-accent focus:outline-none"
            />
            <input
              type="password"
              required
              minLength={6}
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              placeholder="Confirm password"
              className="w-full rounded-md border border-border bg-background/60 px-3 py-2.5 text-sm focus:border-cyan-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-cyan-accent px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 cursor-pointer disabled:opacity-50"
            >
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
