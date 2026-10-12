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
  const batteryMw =
    input.batteryMw != null && Number.isFinite(input.batteryMw) ? input.batteryMw : null;
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
      batteryMw == null ? null : Number((gridMw + batteryMw - facilityMw).toFixed(3)),
    outputDifferenceMw:
      gpuMw == null || otherMw == null ? null : Number((gpuMw + otherMw - facilityMw).toFixed(3)),
  };
}

export function flowWidth(value: number, largest: number) {
  if (value <= 0 || largest <= 0) return 0;
  return (Math.min(value, largest) / largest) * 22;
}

/** Acyclic, conserved flows; charging is a destination at the supply bus. */
export function buildPowerBalanceSankey(balance: PowerBalancePresentation) {
  const nodes: Array<{ name: string; tone: string; mw: number }> = [];
  const links: Array<{ source: number; target: number; value: number }> = [];
  const node = (name: string, tone: string, mw: number) => {
    nodes.push({ name, tone, mw });
    return nodes.length - 1;
  };
  const link = (source: number, target: number, value: number) => {
    if (value > 0) links.push({ source, target, value });
  };
  // Do not turn incompatible readings into a plausible-looking balanced diagram.
  const reconciled =
    balance.inputDifferenceMw != null &&
    Math.abs(balance.inputDifferenceMw) <= 0.05 &&
    (balance.outputDifferenceMw == null || Math.abs(balance.outputDifferenceMw) <= 0.05);
  if (!reconciled) return { nodes, links, reconciled };
  const grid = node("Grid import", "demand", balance.gridMw);
  const charging = balance.batteryDirection === "charge";
  const supply = charging ? node("Supply bus", "demand", balance.gridMw) : null;
  const facility = node("Facility demand", "demand", balance.facilityMw);
  link(grid, supply ?? facility, balance.gridMw);
  if (charging && supply != null) {
    link(supply, facility, balance.facilityMw);
    link(
      supply,
      node("Battery charging", "battery", Math.abs(balance.batteryMw ?? 0)),
      Math.abs(balance.batteryMw ?? 0),
    );
  } else if (balance.batteryDirection === "discharge") {
    link(
      node("Battery discharge", "battery", balance.batteryMw ?? 0),
      facility,
      balance.batteryMw ?? 0,
    );
  }
  if (balance.gpuMw != null) {
    if (balance.gpuMw > 0) link(facility, node("Compute", "compute", balance.gpuMw), balance.gpuMw);
    if ((balance.otherMw ?? 0) > 0)
      link(facility, node("Other load", "reference", balance.otherMw ?? 0), balance.otherMw ?? 0);
  }
  return { nodes, links, reconciled };
}
