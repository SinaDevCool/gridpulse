import { test } from "node:test";
import assert from "node:assert/strict";
import { moduleOwner, solutionBoundaryViolation } from "./solution-boundaries.mjs";
test("solution boundaries reject cross-product and shared-to-domain imports", () => {
  for (const [from, to] of [
    ["src/features/operations/a.ts", "src/features/power-finder/b.ts"],
    ["src/features/grid-connection/a.ts", "src/lib/operations-api.ts"],
    ["src/shared/a.ts", "src/server/operations/repository.ts"],
  ])
    assert.equal(solutionBoundaryViolation(from, to), true);
  assert.equal(
    solutionBoundaryViolation("src/features/operations/a.ts", "src/shared/csv.ts"),
    false,
  );
  assert.equal(
    solutionBoundaryViolation("src/routes/operations.tsx", "src/features/operations/a.ts"),
    false,
  );
  assert.equal(moduleOwner("src\\features\\operations\\a.ts"), "operations");
});
