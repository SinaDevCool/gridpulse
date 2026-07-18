export const caseStages = [
  { id: "site", label: "Site context", shortLabel: "Declare", status: "Recorded" },
  { id: "scenarios", label: "Connection scenarios", shortLabel: "Screen", status: "Indicative" },
  { id: "evidence", label: "Evidence ledger", shortLabel: "Assemble", status: "5 / 7" },
  { id: "execution", label: "Execution room", shortLabel: "Coordinate", status: "4 actions" },
  { id: "decision", label: "Decision memo", shortLabel: "Decide", status: "Blocked" },
] as const;

export type CaseStageId = (typeof caseStages)[number]["id"];

export const connectionCase = {
  id: "GP-DE-001",
  name: "Berlin-Brandenburg BESS + AI Load",
  region: "Brandenburg",
  requirement: "60 MW import · 40 MW export",
  configuration: "40 MW / 80 MWh BESS",
  voltage: "110 kV target",
  likelyOperator: "E.DIS Netz — confirmation required",
  readiness: "Operator evidence required",
} as const;

export const scenarioRows = [
  {
    name: "Unrestricted baseline",
    import: "60 MW",
    export: "40 MW",
    impact: "Baseline only",
    status: "Insufficient evidence",
    detail:
      "Declared requirement retained as a comparison case. It is not evidence of network headroom.",
  },
  {
    name: "Static flexible connection",
    import: "Operator limit required",
    export: "Operator limit required",
    impact: "Dispatch analysis pending",
    status: "Validation required",
    detail:
      "A fixed import or export limit can only be evaluated after the operator supplies binding limits.",
  },
  {
    name: "Dynamic flexible connection",
    import: "Interval schedule required",
    export: "Interval schedule required",
    impact: "Profile analysis pending",
    status: "Validation required",
    detail:
      "Interval restrictions and an operating schedule are required before commercial modelling.",
  },
] as const;

export const evidenceRows = [
  {
    item: "Site coordinates",
    source: "Project brief",
    provenance: "Customer input",
    status: "Recorded",
  },
  {
    item: "BESS technical configuration",
    source: "Technical schedule",
    provenance: "Customer input",
    status: "Recorded",
  },
  {
    item: "Administrative grid area",
    source: "BNetzA map portal",
    provenance: "Official source",
    status: "Recorded",
  },
  {
    item: "Likely operator responsibility",
    source: "Boundary screening",
    provenance: "Screening",
    status: "Assumption",
  },
  {
    item: "Nearby substation context",
    source: "OpenGridMap · verify",
    provenance: "Public source",
    status: "Screened",
  },
  {
    item: "Available network capacity",
    source: "Responsible operator",
    provenance: "Operator evidence",
    status: "Missing",
  },
  {
    item: "FCA operating schedule",
    source: "Connection offer",
    provenance: "Operator evidence",
    status: "Missing",
  },
] as const;

export const executionRows = [
  {
    workstream: "Operator responsibility",
    owner: "Grid lead",
    state: "In review",
    milestone: "Confirm DSO boundary",
  },
  {
    workstream: "Technical application pack",
    owner: "Project engineer",
    state: "Ready",
    milestone: "Issue controlled pack",
  },
  {
    workstream: "Capacity evidence request",
    owner: "Grid lead",
    state: "Not started",
    milestone: "Submit formal enquiry",
  },
  {
    workstream: "FCA operating conditions",
    owner: "Commercial lead",
    state: "Blocked",
    milestone: "Await operator response",
  },
] as const;
