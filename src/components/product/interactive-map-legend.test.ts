import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InteractiveMapLegend } from "./InteractiveMapLegend";

describe("interactive map legend", () => {
  it("renders semantic, keyboard-accessible isolation controls", () => {
    const html = renderToStaticMarkup(
      createElement(InteractiveMapLegend, {
        title: "Map Legend",
        open: true,
        onOpenChange: () => undefined,
        sections: [
          {
            id: "voltage",
            title: "Voltage",
            isolatable: true,
            items: [{ id: "ehv", label: "380 kV and above", color: "#c084fc" }],
          },
        ],
        isolated: { dimension: "voltage", value: "ehv" },
        onIsolate: () => undefined,
        onReset: () => undefined,
      }),
    );
    expect(html).toContain('aria-label="Show all 380 kV and above"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("<button");
    expect(html).toContain('aria-expanded="true"');
  });

  it("explains unavailable categories instead of presenting a false zero", () => {
    const html = renderToStaticMarkup(
      createElement(InteractiveMapLegend, {
        title: "Generation",
        open: true,
        onOpenChange: () => undefined,
        sections: [
          {
            id: "technology",
            title: "Generation",
            isolatable: true,
            items: [
              {
                id: "wind",
                label: "Wind",
                color: "#38bdf8",
                unavailable: true,
                unavailableReason: "Registry data unavailable.",
              },
            ],
          },
        ],
        onIsolate: () => undefined,
      }),
    );
    expect(html).toContain("Registry data unavailable.");
    expect(html).toContain("disabled");
  });
});
