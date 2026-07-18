import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useSubscription } from "@/hooks/use-subscription";
import { createPortalSession } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({ meta: [{ title: "Billing — GridPulse" }] }),
  component: Billing,
});

const PLANS = [
  {
    id: "pro_monthly",
    name: "Pro",
    price: "$29",
    interval: "/mo",
    description: "For professionals who need advanced grid analytics.",
    features: ["All news & projects", "Advanced filters", "Email alerts", "Priority support"],
  },
  {
    id: "enterprise_monthly",
    name: "Enterprise",
    price: "$299",
    interval: "/mo",
    description: "For teams and organizations operating at scale.",
    features: ["Everything in Pro", "Team seats", "API access", "Dedicated support"],
  },
];

function Billing() {
  const { user } = Route.useRouteContext();
  const { subscription, isActive, plan, loading } = useSubscription(user.id);
  const { openCheckout, checkoutElement, isOpen, closeCheckout } = useStripeCheckout();
  const [portalLoading, setPortalLoading] = useState(false);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const result = await createPortalSession({
        data: { environment: getStripeEnvironment(), returnUrl: window.location.href },
      });
      if ("error" in result) throw new Error(result.error);
      window.open(result.url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open billing portal");
    } finally {
      setPortalLoading(false);
    }
  }

  function startCheckout(priceId: string) {
    openCheckout({
      priceId,
      customerEmail: user.email,
      userId: user.id,
      returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PaymentTestModeBanner />
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12 lg:px-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Billing</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose the plan that fits your work with the grid.
        </p>

        {!loading && isActive && subscription && (
          <div className="mt-6 rounded-lg border border-cyan-accent/40 bg-cyan-accent/5 p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm font-medium text-foreground">
                  Current plan: <span className="capitalize">{plan}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Status: {subscription.status}
                  {subscription.current_period_end &&
                    ` · renews ${new Date(subscription.current_period_end).toLocaleDateString()}`}
                  {subscription.cancel_at_period_end && " · cancels at period end"}
                </div>
              </div>
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="rounded-md border border-border px-4 py-2 text-sm hover:border-cyan-accent disabled:opacity-50"
              >
                {portalLoading ? "Opening…" : "Manage subscription"}
              </button>
            </div>
          </div>
        )}

        {isOpen ? (
          <div className="mt-8">
            <button
              onClick={closeCheckout}
              className="mb-4 text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to plans
            </button>
            {checkoutElement}
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {PLANS.map((p) => {
              const isCurrent = isActive && subscription?.price_id === p.id;
              return (
                <div
                  key={p.id}
                  className="rounded-lg border border-border bg-surface/40 p-6 flex flex-col"
                >
                  <div className="text-sm uppercase tracking-wider text-muted-foreground">
                    {p.name}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold">{p.price}</span>
                    <span className="text-sm text-muted-foreground">{p.interval}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
                  <ul className="mt-4 space-y-2 text-sm flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-cyan-accent">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => startCheckout(p.id)}
                    disabled={isCurrent}
                    className="mt-6 rounded-md bg-cyan-accent px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 disabled:opacity-50"
                  >
                    {isCurrent ? "Current plan" : isActive ? "Switch to this plan" : `Upgrade to ${p.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
