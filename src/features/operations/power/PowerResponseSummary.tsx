import { Link, useSearch } from "@tanstack/react-router";
import { formatMw } from "../formatting";
import { humanConstraint, type EvidenceMode } from "./presentation";
import { EvidencePill } from "./primitives";

export function PowerResponseSummary({
  requiredMw,
  batteryMw,
  shortfallMw,
  constraint,
  headline,
  mode,
}: {
  requiredMw: number | null;
  batteryMw: number | null;
  shortfallMw: number | null;
  constraint: string;
  headline: string;
  mode: EvidenceMode;
}) {
  const search = useSearch({ from: "/operations" });
  const achieved = batteryMw == null ? null : Math.max(0, batteryMw);
  const scale = Math.max(requiredMw ?? 0, achieved ?? 0, 1);
  const rows = [
    { label: "Required response", value: requiredMw, tone: "required" },
    { label: "Battery response", value: achieved, tone: "battery" },
    { label: "Residual shortfall", value: shortfallMw, tone: "gap" },
  ];
  return (
    <section
      className="ops-task-review power-response-review"
      aria-label="Battery response capability"
    >
      <header>
        <div>
          <p className="context-label">Read-only dispatch assessment</p>
          <h3>
            {mode === "historical"
              ? "Observed power balance · not a dispatch recommendation"
              : headline}
          </h3>
        </div>
        <EvidencePill mode={mode} />
      </header>
      <div className="power-response-budget">
        <div className="power-response-bars">
          {rows.map(({ label, value, tone }) => (
            <div key={label} className="power-budget-row">
              <span>{label}</span>
              <div className="power-budget-track" aria-hidden="true">
                <i
                  className={tone}
                  style={{
                    width:
                      value == null
                        ? "0%"
                        : `${Math.min(100, (Math.max(0, value) / scale) * 100)}%`,
                  }}
                />
              </div>
              <strong>{value == null ? "Unavailable" : formatMw(value)}</strong>
            </div>
          ))}
        </div>
        <div className="power-binding-note">
          <span>Binding constraint</span>
          <strong>
            {mode === "scenario" ? humanConstraint(constraint) : "Not inferred from observations"}
          </strong>
          {shortfallMw != null && shortfallMw > 0.01 ? (
            <Link to="/operations" search={{ ...search, view: "compute", mode: "scenario" }}>
              Review workload flexibility →
            </Link>
          ) : (
            <span>Review reserve and equipment limits below</span>
          )}
        </div>
      </div>
      <p>
        Positive battery power means discharge; negative power means charge. No physical control
        commands are issued.
      </p>
    </section>
  );
}
