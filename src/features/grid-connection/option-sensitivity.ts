import type { ConnectionOptionResult } from "./connection-options";

export const OPTION_SENSITIVITY_VERSION = "connection-option-sensitivity-v1";

export type OptionSensitivity = {
  methodologyVersion: typeof OPTION_SENSITIVITY_VERSION;
  status: "modelled" | "insufficient_evidence";
  lowExposureEur: number | null;
  baseExposureEur: number | null;
  highExposureEur: number | null;
  assumptions: string[];
};

const round = (value: number) => Math.round(value);

export function buildOptionSensitivity(option: ConnectionOptionResult): OptionSensitivity {
  const base = option.analysis?.estimatedAnnualExposureEur;
  if (base === undefined || base === null) {
    return {
      methodologyVersion: OPTION_SENSITIVITY_VERSION,
      status: "insufficient_evidence",
      lowExposureEur: null,
      baseExposureEur: null,
      highExposureEur: null,
      assumptions: ["A validated interval profile is required before commercial sensitivity."],
    };
  }
  return {
    methodologyVersion: OPTION_SENSITIVITY_VERSION,
    status: "modelled",
    lowExposureEur: round(base * 0.5),
    baseExposureEur: round(base),
    highExposureEur: round(base * 2),
    assumptions: [
      "Low case applies 50% of base restriction frequency and marginal-energy exposure.",
      "High case applies 200% of base restriction frequency and marginal-energy exposure.",
      "The range is deterministic scenario sensitivity, not a probability forecast.",
    ],
  };
}
