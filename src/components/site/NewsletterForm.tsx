import { useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: trimmed });
    setLoading(false);
    if (error) {
      // Unique violation = already subscribed (treat as success for UX).
      if (error.code === "23505") {
        setEmail("");
        toast.success("You're already on the list — see you at 7AM ET.");
        return;
      }
      toast.error("Couldn't subscribe right now. Please try again.");
      return;
    }
    setEmail("");
    toast.success("You're on the list — first brief arrives tomorrow at 7AM ET.");
  }

  return (
    <div className={compact ? "relative" : "relative overflow-hidden rounded-xl border border-cyan-accent/30 bg-gradient-to-br from-cyan-accent/10 via-surface to-surface p-5 neon-cyan-glow"}>
      {!compact && <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />}
      <div className="relative">
        {!compact && (
          <>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-accent">
              <Mail className="h-3.5 w-3.5" /> The GridPulse Brief
            </div>
            <h3 className="mt-3 font-display text-lg font-bold leading-tight">
              The 5 stories shaping grid storage, in your inbox at 7am ET.
            </h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Joined by 14,200+ developers, investors, and utility planners.
            </p>
          </>
        )}
        <form onSubmit={submit} className="mt-4 flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@utility.com"
            className="flex-1 rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-cyan-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-cyan-accent px-3 py-2 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "…" : "Subscribe"}
          </button>
        </form>
      </div>
    </div>
  );
}
