import { Link } from "@tanstack/react-router";
import germany from "@svg-maps/germany";
import { ArrowRight, MapPin } from "lucide-react";
import { useId, useMemo, useState } from "react";

type RegionContext = {
  transmissionContext: string;
  responsibility: string;
};

type GermanyConnectionFinderProps = {
  className?: string;
  showAction?: boolean;
  variant?: "full" | "compact";
};

const regionContext: Record<string, RegionContext> = {
  "Baden-Württemberg": { transmissionContext: "TransnetBW", responsibility: "Probable DSO — confirm for the exact site" },
  Bavaria: { transmissionContext: "TenneT Germany", responsibility: "Probable DSO — confirm for the exact site" },
  Berlin: { transmissionContext: "50Hertz", responsibility: "Stromnetz Berlin — confirmation required" },
  Brandenburg: { transmissionContext: "50Hertz", responsibility: "Probable DSO — confirmation required" },
  Bremen: { transmissionContext: "TenneT Germany", responsibility: "Probable DSO — confirm for the exact site" },
  Hamburg: { transmissionContext: "TenneT Germany", responsibility: "Hamburger Energienetze — confirmation required" },
  Hesse: { transmissionContext: "Amprion / TenneT", responsibility: "Probable DSO — confirm for the exact site" },
  "Lower Saxony": { transmissionContext: "TenneT Germany / Amprion", responsibility: "Probable DSO — confirm for the exact site" },
  "Mecklenburg-Vorpommern": { transmissionContext: "50Hertz", responsibility: "Probable DSO — confirm for the exact site" },
  "North Rhine-Westphalia": { transmissionContext: "Amprion", responsibility: "Probable DSO — confirm for the exact site" },
  "Rhineland-Palatinate": { transmissionContext: "Amprion", responsibility: "Probable DSO — confirm for the exact site" },
  Saarland: { transmissionContext: "Amprion", responsibility: "Probable DSO — confirm for the exact site" },
  Saxony: { transmissionContext: "50Hertz", responsibility: "Probable DSO — confirm for the exact site" },
  "Saxony-Anhalt": { transmissionContext: "50Hertz", responsibility: "Probable DSO — confirm for the exact site" },
  "Schleswig-Holstein": { transmissionContext: "TenneT Germany", responsibility: "Probable DSO — confirm for the exact site" },
  Thuringia: { transmissionContext: "50Hertz", responsibility: "Probable DSO — confirm for the exact site" },
};

export function GermanyConnectionFinder({
  className = "",
  showAction = true,
  variant = "full",
}: GermanyConnectionFinderProps) {
  const selectId = useId();
  const regions = useMemo(() => [...germany.locations].sort((a, b) => a.name.localeCompare(b.name)), []);
  const [selectedId, setSelectedId] = useState(() => regions.find((region) => region.name === "Brandenburg")?.id ?? regions[0].id);
  const selected = regions.find((region) => region.id === selectedId) ?? regions[0];
  const context = regionContext[selected.name] ?? {
    transmissionContext: "Confirm with the responsible operator",
    responsibility: "Operator responsibility requires project-level confirmation",
  };

  return (
    <div className={`connection-finder-shell is-${variant} ${className}`.trim()}>
      <header className="connection-finder-header">
        <div>
          <span>Interactive Chapter 01</span>
          <strong>German location and responsibility screening</strong>
        </div>
        <small>Public context</small>
      </header>

      <div className="connection-finder-body">
        <div className="connection-finder-map-panel">
          <div className="connection-finder-toolbar">
            <label htmlFor={selectId}>Federal state</label>
            <select id={selectId} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>{region.name}</option>
              ))}
            </select>
          </div>

          <div className="connection-finder-map-wrap">
            <svg
              className="connection-finder-map"
              viewBox={germany.viewBox}
              role="img"
              aria-labelledby={`${selectId}-title ${selectId}-description`}
            >
              <title id={`${selectId}-title`}>Interactive map of Germany by federal state</title>
              <desc id={`${selectId}-description`}>Select a federal state to review public transmission context and the operator-confirmation boundary.</desc>
              {regions.map((region) => {
                const active = region.id === selectedId;
                return (
                  <path
                    key={region.id}
                    d={region.path}
                    className={active ? "is-selected" : undefined}
                    role="button"
                    tabIndex={0}
                    aria-label={`Select ${region.name}`}
                    aria-pressed={active}
                    onClick={() => setSelectedId(region.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(region.id);
                      }
                    }}
                  />
                );
              })}
            </svg>
            <div className="connection-finder-map-note"><MapPin aria-hidden="true" /> Select a state</div>
          </div>
        </div>

        <aside className="connection-finder-context" aria-live="polite">
          <span className="connection-finder-index">01</span>
          <h3>{selected.name}</h3>
          <p>Public network context for an early project screen.</p>
          <dl>
            <div><dt>Federal state</dt><dd>{selected.name}</dd></div>
            <div><dt>Transmission context</dt><dd>{context.transmissionContext}</dd></div>
            <div><dt>Likely responsibility</dt><dd>{context.responsibility}</dd></div>
            <div><dt>Capacity evidence</dt><dd className="is-warning">Not established</dd></div>
          </dl>
          <div className="connection-finder-boundary">
            <strong>Validation boundary</strong>
            <p>The map does not infer node capacity, a connection point, or an operator offer. Exact coordinates, voltage and formal operator evidence remain controlling.</p>
          </div>
          {showAction && (
            <Link to="/assessments/new" className="connection-finder-action">
              Continue with this context <ArrowRight aria-hidden="true" />
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
