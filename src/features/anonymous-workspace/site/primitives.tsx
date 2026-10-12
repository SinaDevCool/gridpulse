import { Link } from "@tanstack/react-router";

import { ArrowLeft } from "lucide-react";

import { type Tab,tabDetails,tabs } from "./presentation";

export function WorkspaceStepActions({
  propertyId,
  current,
}: {
  propertyId: string;
  current: Tab;
}) {
  const index = tabs.indexOf(current);
  const previous = index > 0 ? tabs[index - 1] : null;
  const next = index < tabs.length - 1 ? tabs[index + 1] : null;
  return (
    <nav className="workspace-step-actions" aria-label="Property review steps">
      {previous ? (
        <Link to="/portfolio/$id" params={{ id: propertyId }} search={{ tab: previous }}>
          <ArrowLeft aria-hidden="true" /> Back to {tabDetails[previous].label}
        </Link>
      ) : (
        <Link to="/portfolio" search={{ view: "pipeline" }}>
          <ArrowLeft aria-hidden="true" /> Back to Portfolio
        </Link>
      )}
      {next ? (
        <Link
          className="primary-action"
          to="/portfolio/$id"
          params={{ id: propertyId }}
          search={{ tab: next }}
        >
          Next: {tabDetails[next].label}
        </Link>
      ) : (
        <Link className="primary-action" to="/portfolio" search={{ view: "decisions" }}>
          Return to Decision Review
        </Link>
      )}
    </nav>
  );
}

export function StatusMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`workspace-status-metric status-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
