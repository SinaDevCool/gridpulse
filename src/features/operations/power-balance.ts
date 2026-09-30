export type PowerBalancePresentation = {
  facilityMw: number;
  gridMw: number;
  batteryMw: number | null;
  gpuMw: number | null;
  otherMw: number | null;
  batteryDirection: "discharge" | "charge" | "idle" | "unavailable";
  inputDifferenceMw: number | null;
  outputDifferenceMw: number | null;
};

export function buildPowerBalancePresentation(input: {
  facilityMw: number;
  gridMw: number;
  batteryMw: number | null;
  gpuMw: number | null;
}): PowerBalancePresentation {
  const clean = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);
  const facilityMw = clean(input.facilityMw);
  const gridMw = clean(input.gridMw);
  const batteryMw = input.batteryMw != null && Number.isFinite(input.batteryMw) ? input.batteryMw : null;
  const gpuMw = input.gpuMw != null && Number.isFinite(input.gpuMw) ? clean(input.gpuMw) : null;
  const otherMw = gpuMw == null ? null : Number(Math.max(0, facilityMw - gpuMw).toFixed(3));
  const batteryDirection =
    batteryMw == null
      ? "unavailable"
      : batteryMw > 0.005
        ? "discharge"
        : batteryMw < -0.005
          ? "charge"
          : "idle";
  return {
    facilityMw,
    gridMw,
    batteryMw,
    gpuMw,
    otherMw,
    batteryDirection,
    inputDifferenceMw:
      batteryMw == null
        ? null
        : Number((gridMw + batteryMw - facilityMw).toFixed(3)),
    outputDifferenceMw:
      gpuMw == null || otherMw == null
        ? null
        : Number((gpuMw + otherMw - facilityMw).toFixed(3)),
  };
}

export function flowWidth(value: number, largest: number) {
  if (value <= 0 || largest <= 0) return 0;
  return Number((4 + (Math.min(value, largest) / largest) * 18).toFixed(2));
}
