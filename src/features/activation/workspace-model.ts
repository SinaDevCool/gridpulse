export type ActivationSite = {
  id: string;
  name: string;
  project_type: string;
  requested_import_mw: number;
  minimum_viable_import_mw: number | null;
  bess_power_mw: number | null;
  bess_energy_mwh: number | null;
  likely_network_operator: string | null;
};

export type ActivationEnvelope = {
  id: string;
  name: string;
  version: number;
  status: string;
  mode: string;
  max_import_mw: number | null;
  valid_from: string | null;
  valid_to: string | null;
  restriction_schedule: unknown;
};

export type ActivationPoint = {
  hour: number;
  requestedMw: number;
  firmMw: number;
  flexibleMw: number;
  activatedMw: number;
};

export type ActivationWorkspaceModel = {
  requestedMw: number;
  firmMw: number;
  flexibleMw: number;
  activatedMw: number;
  annualFlexibleMwh: number;
  restrictionHours: number;
  evidenceLabel: string;
  evidenceDetail: string;
  envelope: ActivationEnvelope | null;
  timeline: ActivationPoint[];
};

function bounded(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function buildActivationWorkspaceModel(
  site: ActivationSite,
  envelopes: ActivationEnvelope[],
): ActivationWorkspaceModel {
  const envelope = [...envelopes].sort((a, b) => b.version - a.version)[0] ?? null;
  const requestedMw = Math.max(0, site.requested_import_mw);
  const firmMw = bounded(envelope?.max_import_mw ?? requestedMw * 0.84, 0, requestedMw);
  const flexibleMw = bounded(
    envelope ? Math.max(firmMw, requestedMw * 0.95) : requestedMw * 0.95,
    firmMw,
    requestedMw,
  );
  const batteryPower = Math.max(0, site.bess_power_mw ?? requestedMw * 0.05);
  const activatedMw = bounded(flexibleMw + batteryPower, flexibleMw, requestedMw);
  const restrictionRatio = requestedMw ? (requestedMw - flexibleMw) / requestedMw : 0;
  const restrictionHours = Math.round(8760 * restrictionRatio * 0.22);
  const timeline = Array.from({ length: 168 }, (_, hour) => {
    const daily = Math.sin((((hour % 24) - 7) * Math.PI) / 12);
    const weekly = Math.sin((hour * Math.PI) / 84);
    const demand = requestedMw * bounded(0.79 + daily * 0.11 + weekly * 0.04, 0.58, 0.98);
    const envelopeDip = Math.max(0, Math.sin(((hour - 14) * Math.PI) / 36));
    const dynamicFlexible = bounded(
      flexibleMw - envelopeDip * (flexibleMw - firmMw),
      firmMw,
      flexibleMw,
    );
    return {
      hour,
      requestedMw: demand,
      firmMw,
      flexibleMw: dynamicFlexible,
      activatedMw: Math.min(demand, dynamicFlexible + batteryPower),
    };
  });
  return {
    requestedMw,
    firmMw,
    flexibleMw,
    activatedMw,
    annualFlexibleMwh: Math.round((flexibleMw - firmMw) * (8760 - restrictionHours)),
    restrictionHours,
    evidenceLabel: envelope
      ? envelope.status === "agreed"
        ? "Operator-agreed envelope"
        : "Workspace envelope"
      : "Illustrative assumption",
    evidenceDetail: envelope
      ? `Version ${envelope.version} · ${envelope.mode} · ${envelope.status}`
      : "No operator envelope is stored. Values are deterministic planning assumptions, not capacity offers.",
    envelope,
    timeline,
  };
}
