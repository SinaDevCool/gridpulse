import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/subscribe")({
  head: () => ({
    meta: [
      { title: "Pricing — GridPulse" },
      { name: "description", content: "GridPulse plans for individuals, professionals, and enterprises — from free briefings to full API + project database access." },
    ],
  }),
  component: SubscribePage,
});

const tiers = [
  {
    name: "Free",
    price: "$0",
    cadence: "/forever",
    features: ["Daily 7AM Brief", "Read 5 articles/mo", "Top-line market data", "Basic project search"],
    cta: "Start free",
  },
  {
    name: "Pro",
    price: "$29",
    cadence: "/mo",
    highlight: true,
    features: ["Unlimited articles", "Full project database", "Market dashboards", "Policy tracker", "Weekly analyst report"],
    cta: "Start 14-day trial",
  },
  {
    name: "Enterprise",
    price: "$299",
    cadence: "/mo per seat",
    features: ["Everything in Pro", "API access (50k req/mo)", "Custom dashboards", "Slack alerts", "Dedicated analyst"],
    cta: "Contact sales",
  },
];

function SubscribePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1200px] px-4 py-16 lg:px-8">
        <div className="text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">Pricing</div>
          <h1 className="mt-2 font-display text-3xl md:text-5xl font-bold tracking-tight">Pick a plan that fits your desk</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground">
            Built for developers, investors, utilities, EPCs, OEMs, and policymakers. Cancel anytime.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`rounded-xl border p-6 ${t.highlight ? "border-cyan-accent/60 bg-cyan-accent/5 neon-cyan-glow" : "border-border bg-surface/40"}`}
            >
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl font-bold">{t.name}</h2>
                {t.highlight && <span className="rounded border border-cyan-accent/40 bg-cyan-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-accent">Most popular</span>}
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold">{t.price}</span>
                <span className="text-sm text-muted-foreground">{t.cadence}</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2"><Check className="h-4 w-4 text-green-accent mt-0.5 shrink-0" /> {f}</li>
                ))}
              </ul>
              <button
                onClick={() => toast.info("Checkout isn't wired up in this demo build yet.")}
                className={`mt-8 w-full rounded-md px-4 py-2.5 text-sm font-medium cursor-pointer ${
                  t.highlight ? "bg-cyan-accent text-primary-foreground hover:brightness-110" : "border border-border bg-surface hover:border-cyan-accent/40"
                }`}
              >
                {t.cta}
              </button>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
