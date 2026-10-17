import { z } from "zod";

/** Shared physical bounds for scenario requests and direct dispatch calls. */
export const batteryConfigurationFields = z.object({
  maximumDischargePowerMw: z.number().finite().nonnegative().max(2_000),
  maximumChargePowerMw: z.number().finite().nonnegative().max(2_000),
  usableEnergyMwh: z.number().finite().nonnegative().max(20_000),
  initialSocPercent: z.number().finite().min(0).max(100),
  minimumSocPercent: z.number().finite().min(0).max(100),
  maximumSocPercent: z.number().finite().min(0).max(100),
  dischargeEfficiency: z.number().finite().gt(0).max(1),
  chargeEfficiency: z.number().finite().gt(0).max(1),
  rampRateMwPerMinute: z.number().finite().positive().max(2_000),
  minimumDwellMinutes: z.number().int().nonnegative().max(1_440),
  stateOfHealthPercent: z.number().finite().gt(0).max(100),
  available: z.boolean(),
  inverterAvailable: z.boolean(),
});

export function checkBatterySocBounds(
  value: Pick<
    z.infer<typeof batteryConfigurationFields>,
    "minimumSocPercent" | "initialSocPercent" | "maximumSocPercent"
  >,
  context: z.RefinementCtx,
) {
  if (value.minimumSocPercent > value.initialSocPercent)
    context.addIssue({
      code: "custom",
      path: ["minimumSocPercent"],
      message: "Minimum SOC cannot exceed initial SOC.",
    });
  if (value.initialSocPercent > value.maximumSocPercent)
    context.addIssue({
      code: "custom",
      path: ["maximumSocPercent"],
      message: "Maximum SOC cannot be below initial SOC.",
    });
}

export const batteryConfigurationSchema =
  batteryConfigurationFields.superRefine(checkBatterySocBounds);
export type BatteryConfiguration = z.infer<typeof batteryConfigurationSchema>;
