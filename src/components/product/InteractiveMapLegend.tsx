import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";

export type InteractiveLegendItem = {
  id: string;
  label: string;
  color: string;
  shape?: "line" | "dot" | "ring";
  count?: number | null;
  unavailable?: boolean;
  unavailableReason?: string;
  icon?: string;
  status?: string;
};

export type InteractiveLegendSection = {
  id: string;
  dimension?: string;
  title: string;
  description?: string;
  items: readonly InteractiveLegendItem[];
  isolatable?: boolean;
};

type InteractiveMapLegendProps = {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: readonly InteractiveLegendSection[];
  isolated?: { dimension: string; value: string } | null;
  onIsolate?: (dimension: string, value: string) => void;
  onReset?: () => void;
  children?: ReactNode;
  className?: string;
  sourceSummary?: string;
};

export function InteractiveMapLegend({
  title,
  open,
  onOpenChange,
  sections,
  isolated = null,
  onIsolate,
  onReset,
  children,
  className = "",
  sourceSummary,
}: InteractiveMapLegendProps) {
  const [interactive, setInteractive] = useState(false);

  useEffect(() => setInteractive(true), []);

  return (
    <aside
      className={`interactive-map-legend ${open ? "is-open" : "is-collapsed"} ${className}`.trim()}
      aria-label="Map legend and filters"
    >
      <header className="interactive-map-legend__header">
        <button
          type="button"
          className="interactive-map-legend__toggle"
          aria-expanded={open}
          aria-label={open ? "Hide map legend" : "Show map legend"}
          disabled={!interactive}
          onClick={() => onOpenChange(!open)}
        >
          <strong>{title}</strong>
          {open ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
        </button>
        {open && (isolated || onReset) ? (
          <button
            type="button"
            className="interactive-map-legend__reset"
            onClick={onReset}
            disabled={!interactive || !isolated}
          >
            <RotateCcw aria-hidden="true" /> Reset
          </button>
        ) : null}
      </header>
      {open ? (
        <div className="interactive-map-legend__body">
          {sourceSummary ? (
            <p className="interactive-map-legend__source" role="status">
              {sourceSummary}
            </p>
          ) : null}
          {children}
          {sections.map((section) => (
            <section key={section.id} aria-labelledby={`legend-${section.id}`}>
              <h3 id={`legend-${section.id}`}>{section.title}</h3>
              <ul>
                {section.items.map((item) => {
                  const dimension = section.dimension ?? section.id;
                  const active = isolated?.dimension === dimension && isolated.value === item.id;
                  const content = (
                    <>
                      <span
                        className={`interactive-map-legend__symbol is-${item.shape ?? "dot"}`}
                        style={{ "--legend-color": item.color } as CSSProperties}
                        aria-hidden="true"
                      >
                        {item.icon && item.shape !== "line" ? (
                          <img src={item.icon} width="18" height="18" alt="" />
                        ) : null}
                      </span>
                      <span className="interactive-map-legend__label">{item.label}</span>
                      {item.status ? (
                        <span className="interactive-map-legend__status">{item.status}</span>
                      ) : null}
                      {typeof item.count === "number" ? (
                        <span className="interactive-map-legend__count">{item.count}</span>
                      ) : null}
                    </>
                  );
                  return (
                    <li
                      key={item.id}
                      className={active ? "is-isolated" : ""}
                      title={item.unavailable ? item.unavailableReason : undefined}
                    >
                      {section.isolatable && onIsolate ? (
                        <button
                          type="button"
                          className="interactive-map-legend__row"
                          aria-label={`${active ? "Show all" : "Show only"} ${item.label}`}
                          aria-pressed={active}
                          disabled={!interactive || item.unavailable}
                          onClick={() => onIsolate(dimension, item.id)}
                        >
                          {content}
                        </button>
                      ) : (
                        <div className="interactive-map-legend__row">{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {section.description ? <p>{section.description}</p> : null}
            </section>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
