export const SYNTHETIC_FIXTURE_METADATA = {
  source: "synthetic_fixture" as const,
  replaceBeforeProduction: true as const,
  fixtureVersion: "de-demo-grid-assumptions-v1",
  warning: "Invented deterministic assumptions for internal product research only.",
};

export const SYNTHETIC_VOLTAGE_RATING_MIDPOINT_MW = {
  20: 28,
  110: 120,
  220: 320,
  380: 650,
} as const;

export const SYNTHETIC_OPERATING_FACTORS = {
  eveningStress: 0.88,
  highSystemLoad: 1.15,
  minimumVoltageIndicator: 0.88,
  demonstrationVoltagePassIndicator: 0.95,
} as const;
