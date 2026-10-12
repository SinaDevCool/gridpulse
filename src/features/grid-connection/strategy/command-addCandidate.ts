import { screenGermanOperator } from "@/lib/german-grid-screening";
import { type FormEvent } from "react";
import { toast } from "sonner";
import { calculateMaturity } from "../calculations";
import type { ProjectKind,SiteScreeningInput } from "../domain";
import { number } from "./presentation";
import * as strategyQueries from "./repository-command-addCandidate";
import type { useStrategyController } from "./use-strategy-controller";
type Context = Pick<
  ReturnType<typeof useStrategyController>,
  "site" | "setCandidateBusy" | "refetchStrategyRecords"
>;
export async function execute(
  context: Context,
  event: FormEvent<HTMLFormElement>,
): Promise<unknown> {
  const { site, setCandidateBusy, refetchStrategyRecords } = context;
  event.preventDefault();
  setCandidateBusy(true);
  const form = new FormData(event.currentTarget);
  const latitude = Number(form.get("latitude"));
  const longitude = Number(form.get("longitude"));
  const screenedOperator = screenGermanOperator(latitude, longitude);
  const maturity = calculateMaturity({
    projectKind: (site.project_kind || "other_large_consumer") as ProjectKind,
    latitude,
    longitude,
    requestedImportMw: site.requested_import_mw,
    minimumViableImportMw: site.minimum_viable_import_mw ?? 0,
    requestedExportMw: site.requested_export_mw,
    targetVoltageKv: number(form, "targetVoltageKv") || undefined,
    landStatus: String(form.get("landStatus") || "unknown") as SiteScreeningInput["landStatus"],
    planningStatus: String(
      form.get("planningStatus") || "unknown",
    ) as SiteScreeningInput["planningStatus"],
    singleLineDiagramReady: form.get("singleLineDiagramReady") === "on",
    cableRouteStatus: String(
      form.get("cableRouteStatus") || "unknown",
    ) as SiteScreeningInput["cableRouteStatus"],
    financeStatus: String(
      form.get("financeStatus") || "unknown",
    ) as SiteScreeningInput["financeStatus"],
  });
  const { error } = await strategyQueries.insertProjectSiteCandidates1(
    site,
    form,
    screenedOperator,
    maturity,
    latitude,
    longitude,
  );
  setCandidateBusy(false);
  if (error) toast.error(error.message);
  else {
    toast.success("Candidate site added to the comparison");
    event.currentTarget.reset();
    await refetchStrategyRecords();
  }
  return;
}
