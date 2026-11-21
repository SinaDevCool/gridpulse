import { downloadBlob } from "../../lib/tabular-export";
import type { AnonymousSiteStage } from "../anonymous-workspace/portfolio-projection";
import { portfolioStageLabels } from "./portfolio-status";
export function downloadJson(value: unknown, name: string) {
  downloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }), name);
}
export const stageLabel: Record<AnonymousSiteStage, string> = portfolioStageLabels;
