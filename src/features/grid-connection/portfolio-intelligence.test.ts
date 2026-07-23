import { describe, expect, it } from "vitest";
import { buildPortfolioIntelligence, type DecisionPortfolioRow } from "./portfolio-intelligence";

const row = (value: Partial<DecisionPortfolioRow>): DecisionPortfolioRow =>
  ({
    site_id: "a",
    site_name: "Alpha",
    project_type: "large_load",
    requested_import_mw: 100,
    minimum_viable_import_mw: 50,
    target_voltage_kv: 110,
    target_energization_date: null,
    operator_name: "Operator A",
    engagement_status: "not_started",
    evidence_state: "customer_declared",
    indicated_import_mw: null,
    reinforcement_required: null,
    reinforcement_summary: null,
    estimated_connection_cost_eur: null,
    indicated_connection_date: null,
    response_due_at: null,
    offer_expires_at: null,
    reservation_expires_at: null,
    evidence_score: 30,
    evidence_label: "limited evidence",
    missing_evidence: ["operator", "capacity"],
    next_deadline: null,
    ...value,
  }) as DecisionPortfolioRow;

describe("portfolio intelligence", () => {
  it("separates requested MW from operator-indicated MW", () => {
    const result = buildPortfolioIntelligence(
      [
        row({}),
        row({
          site_id: "b",
          site_name: "Beta",
          requested_import_mw: 50,
          indicated_import_mw: 20,
          evidence_score: 80,
        }),
      ],
      { operator: "all", risk: "all", sort: "urgency" },
    );
    expect(result.metrics.totalMw).toBe(150);
    expect(result.metrics.indicatedMw).toBe(20);
    expect(result.metrics.evidenceGapMw).toBe(130);
    expect(result.metrics.atRiskMw).toBe(100);
  });

  it("prioritises deadlines and supports evidence filtering", () => {
    const now = new Date("2026-07-23T00:00:00Z");
    const result = buildPortfolioIntelligence(
      [
        row({ site_id: "a", next_deadline: "2026-07-25T00:00:00Z", evidence_score: 80 }),
        row({ site_id: "b", site_name: "Beta", evidence_score: 30 }),
      ],
      { operator: "all", risk: "deadline", sort: "urgency", now },
    );
    expect(result.rows.map((item) => item.site_id)).toEqual(["a"]);
    expect(result.boundary).toContain("does not aggregate available grid capacity");
  });
});
