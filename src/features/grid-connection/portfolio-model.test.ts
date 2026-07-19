import { describe, expect, it } from "vitest";
import { derivePortfolioProject, filterPortfolioProjects } from "./portfolio-model";

const base = {
  id: "one",
  name: "Berlin load",
  project_type: "data_center",
  latitude: 52.5,
  longitude: 13.4,
  requested_import_mw: 60,
  requested_export_mw: 0,
  assessment_status: "evidence_collection",
  operator_status: "screening",
  likely_network_operator: "Example Netz",
  operator_confirmation_status: "screening_only",
  operator_profile_key: null,
  decision_status: "collect_evidence",
  created_at: "2026-07-01T00:00:00Z",
  documents: 0,
  requirementsReady: 0,
  requirementsTotal: 0,
  hasIntervalProfile: false,
  envelopeStatus: "not_started",
  milestoneDueAt: null,
  reviews: [],
};

describe("portfolio model", () => {
  it("does not treat customer or unknown confirmation as operator confirmation", () => {
    const project = derivePortfolioProject({
      ...base,
      operator_confirmation_status: "customer_confirmed",
    });
    expect(project.operatorStatusLabel).toBe("Customer confirmed");
    expect(project.blockers).toContain("Network operator not confirmed");
  });

  it("does not invent an evidence denominator", () => {
    expect(derivePortfolioProject(base).evidenceLabel).toBe("Requirements not configured");
  });

  it("counts only genuinely overdue unresolved actions", () => {
    const project = derivePortfolioProject(
      {
        ...base,
        reviews: [
          { status: "accepted", due_at: "2026-06-01T00:00:00Z" },
          {
            status: "open",
            due_at: "2026-06-02T00:00:00Z",
            assigned_to_email: "owner@example.com",
          },
        ],
      },
      new Date("2026-07-20T00:00:00Z"),
    );
    expect(project.openReviews).toBe(1);
    expect(project.overdueActions).toBe(1);
    expect(project.owner).toBe("owner@example.com");
  });

  it("filters the work queue by action state and search", () => {
    const blocked = derivePortfolioProject(base);
    const ready = derivePortfolioProject({
      ...base,
      id: "two",
      name: "Frankfurt ready",
      assessment_status: "report_ready",
      decision_status: "envelope_agreed",
      operator_confirmation_status: "operator_confirmed",
      operator_profile_key: "operator",
      documents: 5,
      requirementsReady: 3,
      requirementsTotal: 3,
      hasIntervalProfile: true,
      envelopeStatus: "agreed",
    });
    expect(
      filterPortfolioProjects([ready, blocked], "Berlin", "action_required", "priority"),
    ).toEqual([blocked]);
  });
});
