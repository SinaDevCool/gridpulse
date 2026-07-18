import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — GridPulse" },
      { name: "description", content: "GridPulse is the intelligence layer for grid-scale battery energy storage." },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-16 lg:px-8 prose prose-invert">
        <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight">About GridPulse</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          GridPulse is a real-time intelligence platform for the global grid-scale battery energy storage industry. We
          aggregate, verify, and contextualise news, project data, and market signals from primary sources — EIA, IEA,
          FERC, Ofgem, ISO interconnection queues, BloombergNEF, Wood Mackenzie, and the operating companies themselves.
        </p>
        <h2 className="mt-8 font-display text-xl font-bold">Methodology</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Every story is tagged with its primary source. Capacity and cost figures are normalised to AC/DC and gross/net
          where disclosed. Project entries require at least two independent confirmations before publication.
        </p>
        <h2 className="mt-8 font-display text-xl font-bold">Editorial standards</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          GridPulse maintains a public corrections log. Sponsored content is clearly labelled and never affects the
          editorial feed.
        </p>
      </main>
      <SiteFooter />
    </div>
  ),
});
