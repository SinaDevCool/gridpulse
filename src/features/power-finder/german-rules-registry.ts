import type { FinderProject, FinderProjectType } from "./finder-project";

export type GermanRuleReference = {
  id: string;
  title: string;
  authority: string;
  appliesTo: "all" | "medium_voltage" | "high_voltage" | "extra_high_voltage" | "transmission";
  publicSummary: string;
  url: string;
  reviewedAt: string;
};

export const germanConnectionRules: GermanRuleReference[] = [
  {
    id: "enwg-17-19-49",
    title: "EnWG §§ 17, 19 and 49",
    authority: "Federal Ministry of Justice",
    appliesTo: "all",
    publicSummary:
      "Connection conditions, published operator requirements and generally recognised technical rules govern the connection process.",
    url: "https://www.gesetze-im-internet.de/enwg_2005/",
    reviewedAt: "2026-08-08",
  },
  {
    id: "vde-ar-n-4110",
    title: "VDE-AR-N 4110 — Medium voltage",
    authority: "VDE FNN",
    appliesTo: "medium_voltage",
    publicSummary: "Technical connection framework for customer installations at medium voltage.",
    url: "https://www.vde.com/de/fnn/themen/tar/tar-mittelspannung-vde-ar-n-4110",
    reviewedAt: "2026-08-08",
  },
  {
    id: "vde-ar-n-4120",
    title: "VDE-AR-N 4120 — High voltage",
    authority: "VDE FNN",
    appliesTo: "high_voltage",
    publicSummary: "Technical connection framework for customer installations at high voltage.",
    url: "https://www.vde.com/de/fnn/themen/tar/tar-hochspannung-vde-ar-n-4120",
    reviewedAt: "2026-08-08",
  },
  {
    id: "vde-ar-n-4130",
    title: "VDE-AR-N 4130 — Extra-high voltage",
    authority: "VDE FNN",
    appliesTo: "extra_high_voltage",
    publicSummary:
      "Technical connection framework for customer installations at extra-high voltage.",
    url: "https://www.vde.com/de/fnn/themen/tar",
    reviewedAt: "2026-08-08",
  },
  {
    id: "eu-dcc-2016-1388",
    title: "EU Demand Connection Code 2016/1388",
    authority: "European Union",
    appliesTo: "transmission",
    publicSummary:
      "For transmission-connected demand, import and export capability are specified or agreed with the relevant system operator.",
    url: "https://eur-lex.europa.eu/eli/reg/2016/1388/oj/eng",
    reviewedAt: "2026-08-08",
  },
];

export function ruleReferencesForVoltage(voltageKv: number[]) {
  const maximum = Math.max(0, ...voltageKv);
  const level =
    maximum >= 220 ? "extra_high_voltage" : maximum >= 60 ? "high_voltage" : "medium_voltage";
  return germanConnectionRules.filter(
    (rule) => rule.appliesTo === "all" || rule.appliesTo === level,
  );
}

const categoryQuestions: Record<FinderProjectType, string[]> = {
  data_centre: ["Confirm the coincident import profile and required supply continuity."],
  industrial_load: ["Confirm motor, converter, harmonic and reactive-power characteristics."],
  battery_storage: ["Assess charging and discharging independently at the connection point."],
  co_location: ["Confirm the maximum simultaneous import and export operating envelope."],
  electrolyser: ["Confirm ramp rates, controllability and power-quality characteristics."],
  charging_hub: [
    "Confirm coincident demand, managed-charging controls and reactive-power behaviour.",
  ],
};

export function regulatoryQuestions(project: FinderProject, voltageKv: number[]) {
  const maximum = Math.max(0, ...voltageKv);
  return [
    ...categoryQuestions[project.type],
    `Confirm the applicable VDE/TAB framework for the operator-selected ${maximum || "unknown"} kV connection point.`,
    "Request the operator's network study scope, operating cases and required customer data.",
    "Request written confirmation of import/export capability, connection restrictions and validity period.",
  ];
}
