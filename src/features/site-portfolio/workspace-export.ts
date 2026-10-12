import type { AnonymousSiteStage } from "../anonymous-workspace/portfolio-projection";
import { portfolioStageLabels } from "./portfolio-status";
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
export const stageLabel: Record<AnonymousSiteStage, string> = portfolioStageLabels;
