export type DecisionPortfolioRow = {
  site_id: string;
  site_name: string;
  project_type: string;
  requested_import_mw: number;
  minimum_viable_import_mw: number | null;
  target_voltage_kv: number | null;
  target_energization_date: string | null;
  operator_name: string | null;
  engagement_status: string;
  evidence_state: string;
  indicated_import_mw: number | null;
  reinforcement_required: boolean | null;
  reinforcement_summary: string | null;
  estimated_connection_cost_eur: number | null;
  indicated_connection_date: string | null;
  response_due_at: string | null;
  offer_expires_at: string | null;
  reservation_expires_at: string | null;
  evidence_score: number;
  evidence_label: string;
  missing_evidence: string[];
  next_deadline: string | null;
};

export type PortfolioRiskFilter = "all" | "blocked" | "deadline" | "operator_confirmed";
export type PortfolioSort = "urgency" | "evidence" | "mw" | "name";

export function portfolioRisk(row: DecisionPortfolioRow, now = new Date()) {
  const deadline = row.next_deadline ? new Date(row.next_deadline) : null;
  const daysToDeadline = deadline
    ? Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000)
    : null;
  const severity =
    daysToDeadline != null && daysToDeadline < 0
      ? "critical"
      : daysToDeadline != null && daysToDeadline <= 14
        ? "warning"
        : row.evidence_score < 40
          ? "critical"
          : row.evidence_score < 65
            ? "warning"
            : "stable";
  const urgency =
    (severity === "critical" ? 100 : severity === "warning" ? 60 : 20) +
    Math.min(30, row.missing_evidence.length * 3) +
    Math.min(20, row.requested_import_mw / 10);
  return { severity, urgency, daysToDeadline };
}

export function buildPortfolioIntelligence(
  rows: DecisionPortfolioRow[],
  options: {
    operator: string;
    risk: PortfolioRiskFilter;
    sort: PortfolioSort;
    now?: Date;
  },
) {
  const now = options.now ?? new Date();
  const enriched = rows.map((row) => ({ ...row, risk: portfolioRisk(row, now) }));
  const filtered = enriched.filter((row) => {
    const matchesOperator = options.operator === "all" || row.operator_name === options.operator;
    const matchesRisk =
      options.risk === "all" ||
      (options.risk === "blocked" && row.evidence_score < 65) ||
      (options.risk === "deadline" &&
        row.risk.daysToDeadline != null &&
        row.risk.daysToDeadline <= 30) ||
      (options.risk === "operator_confirmed" && row.evidence_state === "operator_confirmed");
    return matchesOperator && matchesRisk;
  });
  filtered.sort((left, right) => {
    if (options.sort === "evidence") return right.evidence_score - left.evidence_score;
    if (options.sort === "mw") return right.requested_import_mw - left.requested_import_mw;
    if (options.sort === "name") return left.site_name.localeCompare(right.site_name);
    return right.risk.urgency - left.risk.urgency;
  });
  const operatorGroups = Array.from(
    rows.reduce((groups, row) => {
      const operator = row.operator_name ?? "Unconfirmed";
      const current = groups.get(operator) ?? { operator, projects: 0, requestedMw: 0 };
      current.projects += 1;
      current.requestedMw += row.requested_import_mw;
      groups.set(operator, current);
      return groups;
    }, new Map<string, { operator: string; projects: number; requestedMw: number }>()),
  )
    .map(([, value]) => value)
    .sort((left, right) => right.requestedMw - left.requestedMw);
  const totalMw = filtered.reduce((sum, row) => sum + row.requested_import_mw, 0);
  const atRiskMw = filtered
    .filter((row) => row.evidence_score < 65)
    .reduce((sum, row) => sum + row.requested_import_mw, 0);
  const indicatedMw = filtered.reduce((sum, row) => sum + (row.indicated_import_mw ?? 0), 0);
  return {
    rows: filtered,
    operators: operatorGroups,
    metrics: {
      totalMw,
      atRiskMw,
      indicatedMw,
      evidenceGapMw: Math.max(0, totalMw - indicatedMw),
      urgentProjects: filtered.filter(
        (row) => row.risk.severity === "critical" || row.risk.severity === "warning",
      ).length,
      confirmedProjects: filtered.filter((row) => row.evidence_state === "operator_confirmed")
        .length,
    },
    boundary:
      "Portfolio exposure aggregates recorded project requirements and evidence maturity. It does not aggregate available grid capacity or predict connection success.",
  };
}
