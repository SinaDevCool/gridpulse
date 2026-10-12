import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ComputeWorkloadQueue } from "../ComputeWorkloadQueue";
describe("isolated workload queue presentation", () => {
  it("renders the empty state and status controls without network or calculation ownership", () => {
    const html = renderToStaticMarkup(
      createElement(ComputeWorkloadQueue, {
        model: {
          selectedId: null,
          setSelectedId: vi.fn(),
          status: "all",
          setStatus: vi.fn(),
          setQueuePage: vi.fn(),
          interactive: true,
          decisions: [],
          pageCount: 0,
          visiblePage: 0,
          visibleDecisions: [],
        },
      }),
    );
    expect(html).toContain("Workload Queue");
    expect(html).toContain("All statuses");
    expect(html).not.toContain("compute-pagination");
  });
});
