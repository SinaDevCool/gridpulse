import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/product/AppShell";
import {
  OperationsDashboard,
  type OperationsView,
} from "@/features/operations/OperationsDashboard";
import {
  operatingWindowValues,
  operationsModeValues,
  type OperatingWindowPreset,
  type OperationsDataMode,
} from "@/features/operations/operating-context";
import "@/features/operations/operations.css";

const legacyViewDestination: Record<string, OperationsView> = {
  battery: "power",
  forecast: "overview",
  verification: "overview",
  data: "overview",
};

const operationsSearchSchema = z.object({
  view: z.string().catch("overview").default("overview"),
  window: z.enum(operatingWindowValues).catch("today").default("today"),
  mode: z.enum(operationsModeValues).catch("scenario").default("scenario"),
});

export const Route = createFileRoute("/operations")({
  validateSearch: operationsSearchSchema,
  beforeLoad: ({ search }) => {
    const view = search.view;
    if (view === "overview" || view === "compute" || view === "power") return;
    throw redirect({
      to: "/operations",
      search: {
        view: legacyViewDestination[view] ?? "overview",
        window: search.window,
        mode: search.mode,
      },
      replace: true,
    });
  },
  head: () => ({ meta: [{ title: "Power Operations | GridPulse" }] }),
  component: OperationsPage,
});

function OperationsPage() {
  const { view, window, mode } = Route.useSearch();
  return (
    <AppShell>
      <OperationsDashboard
        view={view as OperationsView}
        window={window as OperatingWindowPreset}
        mode={mode as OperationsDataMode}
      />
    </AppShell>
  );
}
