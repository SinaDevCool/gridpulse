import { CircleAlert, ClipboardCheck, MapPinned, Route } from "lucide-react";
import "./public-journey.css";

export const PUBLIC_JOURNEY = [
  {
    id: "discover",
    label: "Discover the route",
    description: "Qualify candidate sites, requirements, responsibility, and evidence gaps.",
    icon: MapPinned,
  },
  {
    id: "design",
    label: "Design the connection strategy",
    description: "Compare firm, reduced, staged, and flexible connection hypotheses.",
    icon: Route,
  },
  {
    id: "prepare",
    label: "Prepare for activation",
    description: "Assemble the evidence, operator questions, and decision package.",
    icon: ClipboardCheck,
  },
] as const;

export type PublicJourneyId = (typeof PUBLIC_JOURNEY)[number]["id"];

export function PublicJourney({ active }: { active?: PublicJourneyId }) {
  return (
    <ol className="public-journey" aria-label="GridPulse connection journey">
      {PUBLIC_JOURNEY.map((stage, index) => {
        const Icon = stage.icon;
        return (
          <li className={active === stage.id ? "is-active" : undefined} key={stage.id}>
            <span className="public-journey-number">0{index + 1}</span>
            <Icon aria-hidden="true" />
            <div>
              <strong>{stage.label}</strong>
              <p>{stage.description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ProductBoundaryNotice({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={compact ? "public-boundary is-compact" : "public-boundary"}>
      <CircleAlert aria-hidden="true" />
      <p>
        <strong>Decision support—not a connection offer.</strong> Available capacity, connection
        point, restrictions, works, timing, and final terms require confirmation by the responsible
        network operator.
      </p>
    </aside>
  );
}
