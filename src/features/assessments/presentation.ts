import { type AssessmentView } from "@/features/grid-connection/workflow-navigation";

export type Tab = AssessmentView;

export function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
