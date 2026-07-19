export type CustomerPathway = {
  key: "firm" | "staged" | "flexible";
  title: string;
  description: string;
  status: string;
  candidate: boolean;
};

export function buildCustomerPathways({
  requestedImportMw,
  minimumViableImportMw,
  hasIntervalProfile,
}: {
  requestedImportMw: number;
  minimumViableImportMw: number | null;
  hasIntervalProfile: boolean;
}): CustomerPathway[] {
  const stagedCandidate =
    minimumViableImportMw != null &&
    minimumViableImportMw > 0 &&
    minimumViableImportMw < requestedImportMw;
  return [
    {
      key: "firm",
      title: "Requested firm connection",
      description: `Test the full ${requestedImportMw} MW requirement through the applicable Netzanschluss process.`,
      status: "Requires network study and operator confirmation",
      candidate: false,
    },
    {
      key: "staged",
      title: "Staged energisation",
      description: stagedCandidate
        ? `Explore an initial ${minimumViableImportMw} MW stage while later capacity remains subject to reinforcement.`
        : "Declare a commercially viable first stage below the full requirement before testing this pathway.",
      status: stagedCandidate
        ? "Candidate for operator discussion"
        : "Additional customer input required",
      candidate: stagedCandidate,
    },
    {
      key: "flexible",
      title: "Flexible connection",
      description:
        "Test static or dynamic limits under §17(2b) EnWG using a representative operating profile.",
      status: hasIntervalProfile
        ? "Profile available for scenario analysis"
        : "Interval profile required before analysis",
      candidate: hasIntervalProfile,
    },
  ];
}
