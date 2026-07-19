import { describe, expect, it } from "vitest";
import { mayEdit, maySignAs, roleLabel } from "./project-roles";

describe("project role boundaries", () => {
  it("keeps viewers read only", () => expect(mayEdit("viewer")).toBe(false));
  it("lets contributors edit without impersonating a reviewer", () => {
    expect(mayEdit("customer_contributor")).toBe(true);
    expect(maySignAs("customer_contributor", "grid_expert")).toBe(false);
  });
  it("requires an exact signing-role match", () => {
    expect(maySignAs("grid_expert", "grid_expert")).toBe(true);
    expect(maySignAs("workspace_admin", "grid_expert")).toBe(false);
  });
  it("provides client-facing labels", () => {
    expect(roleLabel("technical_reviewer")).toBe("Technical reviewer");
  });
});
