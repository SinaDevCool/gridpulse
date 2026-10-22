import { Link } from "@tanstack/react-router";
import type { OperationsView } from "./view-contracts";
import type { OperatingWindowPreset, OperationsDataMode } from "./operating-context";

export function OperationsNavigation({
  view,
  window,
  mode,
}: {
  view: OperationsView;
  window: OperatingWindowPreset;
  mode: OperationsDataMode;
}) {
  return (
    <nav className="solution-ribbon" aria-label="Power Operations views">
      {(
        [
          ["overview", "Overview"],
          ["compute", "Compute & Workloads"],
          ["power", "Power & Battery"],
        ] as const
      ).map(([id, label]) => (
        <Link
          key={id}
          to="/operations"
          search={{ view: id, window, mode: id === "power" ? mode : "scenario" }}
          className={view === id ? "active" : undefined}
          aria-current={view === id ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
