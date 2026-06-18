import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — GridPulse" }] }),
  component: Settings,
});

function Settings() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setName(data?.name ?? "");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user.id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Profile updated.");
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 lg:px-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage your account.</p>

        <form onSubmit={save} className="mt-8 space-y-4 rounded-lg border border-border bg-surface/40 p-6">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Email</label>
            <div className="mt-1 text-sm text-foreground">{user.email}</div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground" htmlFor="name">Display name</label>
            <input
              id="name"
              value={name}
              disabled={loading}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background/60 px-3 py-2.5 text-sm focus:border-cyan-accent focus:outline-none"
              placeholder="Your name"
            />
          </div>
          <button
            type="submit"
            disabled={saving || loading}
            className="rounded-md bg-cyan-accent px-4 py-2 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>

        <div className="mt-6 rounded-lg border border-border bg-surface/40 p-6">
          <div className="text-sm font-medium text-foreground">Billing & subscription</div>
          <p className="mt-1 text-xs text-muted-foreground">Upgrade your plan or manage your subscription.</p>
          <Link
            to="/billing"
            className="mt-3 inline-block rounded-md border border-border px-4 py-2 text-sm text-foreground hover:border-cyan-accent hover:text-cyan-accent"
          >
            Go to billing
          </Link>
        </div>

        <div className="mt-6 rounded-lg border border-border bg-surface/40 p-6">
          <div className="text-sm font-medium text-foreground">Sign out</div>
          <p className="mt-1 text-xs text-muted-foreground">End your session on this device.</p>
          <button
            onClick={signOut}
            className="mt-3 rounded-md border border-border px-4 py-2 text-sm text-foreground hover:border-red-accent hover:text-red-accent"
          >
            Sign out
          </button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
