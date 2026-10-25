import type { OperationsView } from "./view-contracts";
import type { CanonicalInspectionProps } from "./canonical-view-props";
import { CanonicalOverviewView } from "./CanonicalOverviewView";
import { CanonicalBatteryView } from "./CanonicalBatteryView";
import { CanonicalComputeView } from "./CanonicalComputeView";

export function CanonicalAssessmentView({ view, ...props }: CanonicalInspectionProps & { view: OperationsView }) {
  if (view === "overview") return <CanonicalOverviewView {...props} />;
  if (view === "power") return <CanonicalBatteryView {...props} />;
  return <CanonicalComputeView key={props.assessment.projected.identity.resultFingerprint} {...props} />;
}
