import { describe, expect, it } from "vitest";
import type { CandidateSite } from "@/lib/assessment-model";
import { assessOperatorQualification } from "./operator-qualification";

const site = {
  requested_import_mw: 100,
  likely_network_operator: "E.DIS Netz GmbH",
  operator_confirmation_status: "unconfirmed",
  responsible_operator_name: null,
} as CandidateSite;

describe("operator qualification", () => {
  it("holds an unstructured screening case", () => {
    const result = assessOperatorQualification({
      site,
      requirements: [],
      documents: [],
      correspondence: [],
      preferredCandidateCount: 0,
      engagementCount: 0,
    });
    expect(result.gate).toBe("hold");
    expect(result.blockers).toContain("Preferred connection candidate");
    expect(result.boundary).toContain("does not confirm capacity");
  });

  it("allows submission only when every control is ready", () => {
    const result = assessOperatorQualification({
      site: {
        ...site,
        operator_confirmation_status: "confirmed",
        responsible_operator_name: "E.DIS Netz GmbH",
      },
      requirements: [{ status: "ready" }] as never,
      documents: [{ source_classification: "operator_source", review_status: "reviewed" }] as never,
      correspondence: [{}] as never,
      preferredCandidateCount: 1,
      engagementCount: 1,
    });
    expect(result.gate).toBe("ready_to_submit");
    expect(result.score).toBe(100);
    expect(result.blockers).toEqual([]);
  });
});
