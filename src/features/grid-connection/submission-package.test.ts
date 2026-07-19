import { describe, expect, it } from "vitest";
import {
  buildSubmissionManifest,
  submissionStatus,
  type SubmissionInput,
} from "./submission-package";

const base: SubmissionInput = {
  project: { requested_import_mw: 60 },
  evidence: [{ id: "e1" }],
  documents: [{ id: "d1", source_classification: "operator_source" }],
  nodes: [{ id: "n1" }],
  capacitySnapshots: [{ id: "c1", status: "operator_confirmed" }],
  scenarios: [],
  operatorDecisions: [],
  milestones: [{ id: "m1", status: "completed" }],
  pilot: { engagement_authorized: true },
  questions: ["Which node controls the application?"],
};

describe("controlled submission package", () => {
  it("separates operator-confirmed capacity from ordinary evidence", () => {
    const manifest = buildSubmissionManifest(base);
    expect(manifest.counts.operatorConfirmed).toBe(1);
    expect(manifest.counts.openGates).toBe(0);
  });
  it("blocks approved release when gates remain open", () => {
    expect(submissionStatus(2, "approved_for_operator")).toBe("internal_review");
  });
  it("allows an approved label only when all release gates pass", () => {
    expect(submissionStatus(0, "approved_for_operator")).toBe("approved_for_operator");
  });
});
