import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildOperationsScenario, defaultOperationsScenario } from "../scenario-engine";
import { WorkspaceInputs } from "./WorkspaceInputs";

describe("Operating context production evidence boundary", () => {
  it.each([true, false])("keeps the live-control boundary in server HTML (MILP: %s)", (milp) => {
    const html = renderToStaticMarkup(createElement(WorkspaceInputs, {
      model: buildOperationsScenario(defaultOperationsScenario),
      mode: "scenario",
      window: "today",
      view: "power",
      onWindow: () => {},
      onMode: () => {},
      milp,
    }));
    expect(html).toContain("Live control unavailable");
    if (milp) expect(html).toContain("All three tabs inspect the same accepted workload and battery plan.");
  });
});
