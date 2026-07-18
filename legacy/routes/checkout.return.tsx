import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/checkout/return")({
  head: () => ({ meta: [{ title: "Payment complete — GridPulse" }] }),
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-20 lg:px-8 text-center">
        {session_id ? (
          <>
            <h1 className="font-display text-3xl font-bold tracking-tight">Payment complete</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Your subscription is being activated. This may take a few seconds.
            </p>
            <Link
              to="/dashboard"
              className="mt-6 inline-block rounded-md bg-cyan-accent px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110"
            >
              Go to dashboard
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-bold tracking-tight">No session found</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              We couldn't find your checkout session.
            </p>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
