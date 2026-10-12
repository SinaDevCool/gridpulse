export const finderProjectTypes = {
  data_centre: {
    label: "Data centre",
    description: "Continuous large-load screening with continuity requirements.",
    questions: [
      "Which connection point and voltage level should be assessed for the declared import?",
      "Which reinforcement and energisation milestones control the requested date?",
      "Can redundant or staged supply arrangements be considered?",
    ],
  },
  industrial_load: {
    label: "Large industrial load",
    description: "Industrial demand screening before formal operator engagement.",
    questions: [
      "Which connection point should be assessed for the declared peak demand?",
      "Which reinforcement works and Baukostenzuschuss methodology may apply?",
      "Could a staged or flexible connection be considered under Section 17(2b) EnWG?",
    ],
  },
  battery_storage: {
    label: "Battery storage",
    description: "Separate charging and discharging requirements with storage context.",
    questions: [
      "What import capacity can be assessed for charging?",
      "What export capacity can be assessed for discharging?",
      "Are separate restrictions or allocation processes applied in each direction?",
      "Could a flexible connection agreement or shared connection be considered?",
      "Which Baukostenzuschuss methodology applies to the requested import capacity?",
    ],
  },
  co_location: {
    label: "Load + storage",
    description: "Combined load, storage and shared-connection screening.",
    questions: [
      "Can the load and storage share one connection point and capacity envelope?",
      "Which import and export limits would apply to the combined project?",
      "Can operational restrictions reduce the required connection capacity?",
    ],
  },
  electrolyser: {
    label: "Electrolyser",
    description: "Flexible large-load screening using electricity-grid context only.",
    questions: [
      "Which connection point should be assessed for the declared electrical demand?",
      "Could flexible consumption improve the connection pathway?",
      "Which grid charges and connection-cost methodology require project-specific review?",
    ],
  },
  charging_hub: {
    label: "Charging hub",
    description: "Peak-demand screening for fleet, depot or public charging projects.",
    questions: [
      "Which connection point and voltage level should be assessed for coincident peak demand?",
      "Can managed charging support a reduced or staged connection request?",
      "Which connection costs and metering requirements may apply?",
    ],
  },
} as const;

export type FinderProjectType = keyof typeof finderProjectTypes;

export type FinderRedundancy = "single_feed" | "dual_feed" | "n_minus_one";
export type FinderLoadProfile = "flat" | "business_hours" | "managed_charging" | "flexible_process";

export type FinderProject = {
  name: string;
  type: FinderProjectType;
  latitude: number | null;
  longitude: number | null;
  importMw: number;
  ultimateImportMw: number;
  exportMw: number;
  minimumFirmMw: number;
  flexibleLoadMw: number;
  targetEnergisationYear: number;
  preferredVoltageKv: number | null;
  redundancy: FinderRedundancy;
  loadProfile: FinderLoadProfile;
  annualConsumptionGwh: number;
  maxInterruptionHours: number;
  annualInterruptionLimit: number;
  batteryPowerMw: number;
  batteryEnergyMwh: number;
  batteryRoundTripEfficiencyPct: number;
  batteryReservePct: number;
  onsiteGenerationMw: number;
  maxDistanceKm: number;
  updatedAt: string;
};

export const defaultFinderProject: FinderProject = {
  name: "Untitled screening project",
  type: "data_centre",
  latitude: null,
  longitude: null,
  importMw: 100,
  ultimateImportMw: 100,
  exportMw: 0,
  minimumFirmMw: 100,
  flexibleLoadMw: 0,
  targetEnergisationYear: 2028,
  preferredVoltageKv: null,
  redundancy: "single_feed",
  loadProfile: "flat",
  annualConsumptionGwh: 788.4,
  maxInterruptionHours: 0,
  annualInterruptionLimit: 0,
  batteryPowerMw: 0,
  batteryEnergyMwh: 0,
  batteryRoundTripEfficiencyPct: 88,
  batteryReservePct: 20,
  onsiteGenerationMw: 0,
  maxDistanceKm: 20,
  updatedAt: new Date(0).toISOString(),
};

export function isStorageProject(type: FinderProjectType) {
  return type === "battery_storage" || type === "co_location";
}

export function projectOperatorQuestions(project: FinderProject) {
  return [
    "Please confirm the responsible network operator and suitable connection point.",
    ...finderProjectTypes[project.type].questions,
    "Please state whether the response is indicative or binding, its validity period, and the evidence required for the next stage.",
  ];
}
