import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Release5Manifest = {
  manifest_sha256?: string;
  private_operator_data_published: boolean;
  private_extracted_text_published: boolean;
  private_document_identifiers_published: boolean;
  all_repository_gates_passed: boolean;
  benchmark: {
    discrepancy_statuses: { import_limit_mw: string };
    restriction_rehearsal: { residual_mw: number };
  };
  public_capacity_boundary: {
    operator_evidence_applied_to_public_map: boolean;
    reference_map_values_unchanged: boolean;
    operator_confirmation_created: boolean;
    automatic_dispatch_authorized: boolean;
  };
};

const loadManifest = () =>
  JSON.parse(
    readFileSync(resolve("public/power-finder/release5-governance.json"), "utf8"),
  ) as Release5Manifest;

describe("Release 5 public governance", () => {
  it("is reproducible and excludes private evidence", () => {
    const document = loadManifest();
    const expected = document.manifest_sha256;
    expect(expected).toMatch(/^[a-f0-9]{64}$/);
    delete document.manifest_sha256;
    expect(createHash("sha256").update(JSON.stringify(document)).digest("hex")).toBe(expected);
    expect(document.private_operator_data_published).toBe(false);
    expect(document.private_extracted_text_published).toBe(false);
    expect(document.private_document_identifiers_published).toBe(false);
    expect(JSON.stringify(document)).not.toContain("reviewedText");
    expect(JSON.stringify(document)).not.toContain("sourceDocumentId");
  });

  it("keeps operator evidence and restriction rehearsals off the public map", () => {
    const document = loadManifest();
    expect(document.all_repository_gates_passed).toBe(true);
    expect(document.benchmark.discrepancy_statuses.import_limit_mw).toBe("conflict");
    expect(document.benchmark.restriction_rehearsal.residual_mw).toBe(3.5);
    expect(document.public_capacity_boundary).toMatchObject({
      operator_evidence_applied_to_public_map: false,
      reference_map_values_unchanged: true,
      operator_confirmation_created: false,
      automatic_dispatch_authorized: false,
    });
  });
});
