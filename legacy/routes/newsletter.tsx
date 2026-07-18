import { createFileRoute } from "@tanstack/react-router";
import { Mail, CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { NewsletterForm } from "@/components/site/NewsletterForm";

export const Route = createFileRoute("/newsletter")({
  head: () => ({
    meta: [
      { title: "Newsletter — GridPulse Brief" },
      { name: "description", content: "Get the 5 stories shaping grid-scale battery storage every morning at 7am ET. Free." },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-16 lg:px-8">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-accent">
          <Mail className="h-3.5 w-3.5" /> The GridPulse Brief
        </div>
        <h1 className="mt-4 font-display text-3xl md:text-5xl font-bold tracking-tight">
          The 5 stories shaping grid storage, every morning at 7AM ET.
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Joined by 14,200+ developers, investors, utility planners, and policymakers. Free, ad-free, no spam.
        </p>
        <div className="mt-8 glass-card rounded-xl p-6">
          <NewsletterForm compact />
          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            {["Top 5 stories with editorial context", "Project tracker — new awards, COD updates, queue moves", "Market data: cell prices, ERCOT/CAISO spreads, queue volumes", "Policy alerts: FERC, EU, UK, ISO/RTO"].map((b) => (
              <li key={b} className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-green-accent shrink-0 mt-0.5" /> {b}</li>
            ))}
          </ul>
        </div>
      </main>
      <SiteFooter />
    </div>
  ),
});
