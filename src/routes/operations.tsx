import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/product/AppShell";
import { OperationsDashboard, type OperationsView } from "@/features/operations/OperationsDashboard";
import "@/features/operations/operations.css";

const legacyViewDestination: Record<string, OperationsView> = {
  battery: "power",
  forecast: "overview",
  verification: "overview",
  data: "overview",
};

const operationsSearchSchema = z.object({
  view: z.string().catch("overview").default("overview"),
});

export const Route = createFileRoute("/operations")({
  validateSearch: operationsSearchSchema,
  beforeLoad: ({ search }) => {
    const view = search.view;
    if (view === "overview" || view === "compute" || view === "power") return;
    throw redirect({
      to: "/operations",
      search: { view: legacyViewDestination[view] ?? "overview" },
      replace: true,
    });
  },
  head: () => ({ meta: [{ title: "Power Operations | GridPulse" }] }),
  component: OperationsPage,
});

function OperationsPage() {
  const { view } = Route.useSearch();
  return <AppShell><OperationsDashboard view={view as OperationsView} /></AppShell>;
}
