/** Production-owned capital screen; it does not replay operations or settle delivery. */
export type StorageLcosInput = {
  powerMw: number | null; durationHours: number | null; cyclesPerYear: number | null;
  roundTripEfficiencyPct: number | null; capexPowerEurPerKw: number | null;
  capexEnergyEurPerKwh: number | null; fixedOpexEurPerKwYear: number | null;
  variableOpexEurPerMwh: number | null; chargingEnergyPriceEurPerMwh: number | null;
  discountRatePct: number | null; economicLifeYears: number | null;
};

export type StorageLcosResult = {
  energyMwh: number; annualDischargedMwh: number; annualChargingMwh: number;
  installedCostEur: number; annualizedCapexEur: number; annualFixedOpexEur: number;
  annualVariableOpexEur: number; annualChargingCostEur: number; annualCostEur: number;
  lcosEurPerMwh: number;
};

const present = (value: number | null) => value !== null && Number.isFinite(value);

export function calculateStorageLcos(input: StorageLcosInput): StorageLcosResult | null {
  if (!Object.values(input).every((value) => present(value))) return null;
  const values = input as Record<keyof StorageLcosInput, number>;
  if (values.powerMw <= 0 || values.durationHours <= 0 || values.cyclesPerYear <= 0 ||
      values.roundTripEfficiencyPct <= 0 || values.roundTripEfficiencyPct > 100 ||
      values.discountRatePct < 0 || values.economicLifeYears <= 0) return null;
  const energyMwh = values.powerMw * values.durationHours;
  const annualDischargedMwh = energyMwh * values.cyclesPerYear;
  const annualChargingMwh = annualDischargedMwh / (values.roundTripEfficiencyPct / 100);
  const installedCostEur = values.powerMw * 1_000 * values.capexPowerEurPerKw +
    energyMwh * 1_000 * values.capexEnergyEurPerKwh;
  const rate = values.discountRatePct / 100;
  const capitalRecoveryFactor = rate === 0 ? 1 / values.economicLifeYears :
    (rate * (1 + rate) ** values.economicLifeYears) / ((1 + rate) ** values.economicLifeYears - 1);
  const annualizedCapexEur = installedCostEur * capitalRecoveryFactor;
  const annualFixedOpexEur = values.powerMw * 1_000 * values.fixedOpexEurPerKwYear;
  const annualVariableOpexEur = annualDischargedMwh * values.variableOpexEurPerMwh;
  const annualChargingCostEur = annualChargingMwh * values.chargingEnergyPriceEurPerMwh;
  const annualCostEur = annualizedCapexEur + annualFixedOpexEur + annualVariableOpexEur + annualChargingCostEur;
  return { energyMwh, annualDischargedMwh, annualChargingMwh, installedCostEur,
    annualizedCapexEur, annualFixedOpexEur, annualVariableOpexEur,
    annualChargingCostEur, annualCostEur, lcosEurPerMwh: annualCostEur / annualDischargedMwh };
}
