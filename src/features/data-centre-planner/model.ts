export type DataCentreDesignInput = {
  itLoadMw: number;
  pue: number;
  loadFactorPct: number;
  renewableEnergyFactorPct: number;
  energyReuseFactorPct: number;
  wueLitresPerKwhIt: number;
  wasteHeatTemperatureC: number | null;
};

export type DataCentreDesignResult = {
  facilityPeakMw: number;
  averageFacilityMw: number;
  annualItEnergyGwh: number;
  annualFacilityEnergyGwh: number;
  annualOverheadEnergyGwh: number;
  annualRenewableEnergyGwh: number;
  annualNonRenewableEnergyGwh: number;
  annualReusableHeatGwh: number;
  annualWaterM3: number;
  warnings: string[];
};

const finite = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback);
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, finite(value)));
const round = (value: number, digits = 2) => Number(value.toFixed(digits));

export function calculateDataCentreDesign(input: DataCentreDesignInput): DataCentreDesignResult {
  const warnings: string[] = [];
  const itLoadMw = Math.max(0, finite(input.itLoadMw));
  const pue = clamp(input.pue, 1, 3);
  const loadFactor = clamp(input.loadFactorPct, 0, 100) / 100;
  const ref = clamp(input.renewableEnergyFactorPct, 0, 100) / 100;
  const erf = clamp(input.energyReuseFactorPct, 0, 100) / 100;
  const wue = clamp(input.wueLitresPerKwhIt, 0, 20);
  if (input.pue < 1 || input.pue > 3)
    warnings.push("PUE was constrained to the validated planning range of 1.0–3.0.");
  if (input.renewableEnergyFactorPct < 0 || input.renewableEnergyFactorPct > 100)
    warnings.push("REF was constrained to 0–100%.");
  if (input.energyReuseFactorPct < 0 || input.energyReuseFactorPct > 100)
    warnings.push("ERF was constrained to 0–100%.");
  const annualItEnergyGwh = itLoadMw * loadFactor * 8.76;
  const annualFacilityEnergyGwh = annualItEnergyGwh * pue;
  return {
    facilityPeakMw: round(itLoadMw * pue),
    averageFacilityMw: round(itLoadMw * loadFactor * pue),
    annualItEnergyGwh: round(annualItEnergyGwh),
    annualFacilityEnergyGwh: round(annualFacilityEnergyGwh),
    annualOverheadEnergyGwh: round(annualFacilityEnergyGwh - annualItEnergyGwh),
    annualRenewableEnergyGwh: round(annualFacilityEnergyGwh * ref),
    annualNonRenewableEnergyGwh: round(annualFacilityEnergyGwh * (1 - ref)),
    annualReusableHeatGwh: round(annualFacilityEnergyGwh * erf),
    annualWaterM3: round((annualItEnergyGwh * 1_000_000 * wue) / 1_000, 0),
    warnings,
  };
}
