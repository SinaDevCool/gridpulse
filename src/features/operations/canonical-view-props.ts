import type { CanonicalPresentation } from "./canonical-presentation";

/** Inspection remains owned by OperationsDashboard, including cross-tab pin/preview state. */
export type CanonicalInspectionProps = {
  assessment: CanonicalPresentation; timestamp: string; onSelect: (time: string) => void;
  preview: string | null; onPreview: (time: string | null) => void;
  selectedWorkloadId?: string | null; onWorkloadSelect?: (id: string | null) => void;
};
