import { useState, type ReactNode } from "react";

/** Shared map panel chrome; each population retains its own table projection. */
export function FinderResultsDock({
  title,
  summary,
  onClose,
  children,
  tools,
}: {
  title: string;
  summary: string;
  onClose: () => void;
  children: ReactNode;
  tools?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section
      className={`finder-results-dock${expanded ? " is-expanded" : ""}`}
      aria-labelledby="finder-results-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header>
        <div>
          <h2 id="finder-results-title">{title}</h2>
          <p>{summary}</p>
        </div>
        <div className="finder-results-dock__actions">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="finder-results-scroll"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Compact table" : "Expand table"}
          </button>
          <button type="button" onClick={onClose}>
            Return to cards
          </button>
        </div>
      </header>
      {tools && (
        <details className="finder-table-tools">
          <summary>Table options &amp; exports</summary>
          {tools}
        </details>
      )}
      <div
        id="finder-results-scroll"
        className="finder-results-scroll"
        tabIndex={0}
        role="region"
        aria-label={`Scrollable ${title.toLowerCase()}`}
      >
        {children}
      </div>
    </section>
  );
}
