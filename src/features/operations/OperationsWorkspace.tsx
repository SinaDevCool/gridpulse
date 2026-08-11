import {
  AlertTriangle,
  BatteryCharging,
  CircleCheck,
  Gauge,
  LockKeyhole,
  RadioTower,
} from "lucide-react";
import type { ReactNode } from "react";
import { buildOperationsModel, type OperationsEvent } from "./workspace-model";

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function line(values: number[], max: number) {
  return values
    .map((v, i) => `${i ? "L" : "M"} ${(i / (values.length - 1)) * 1000} ${230 - (v / max) * 195}`)
    .join(" ");
}
export function OperationsWorkspace({
  requestedMw,
  firmMw,
  events,
}: {
  requestedMw: number;
  firmMw: number;
  events: OperationsEvent[];
}) {
  const model = buildOperationsModel(requestedMw, firmMw, events);
  const maximum = Math.max(1, requestedMw);
  return (
    <section className="operations-workspace" aria-label="Power Operations workspace">
      <div className="operations-mode">
        <span className={model.mode.toLowerCase()}>
          <RadioTower aria-hidden="true" /> {model.mode}
        </span>
        <p>
          {model.mode === "SHADOW"
            ? "Stored integration events are replayed for advisory monitoring."
            : "Deterministic fixture data—no live telemetry or network instruction."}
        </p>
      </div>
      <div className="operations-grid">
        <article className="operations-main">
          <header>
            <div>
              <p className="context-label">Last 60 Minutes</p>
              <h2>Demand & Network Envelope</h2>
            </div>
            <strong>{numberFormatter.format(model.limitMw)} MW limit</strong>
          </header>
          <svg
            viewBox="0 0 1000 250"
            role="img"
            aria-label="Simulated power demand and network limit"
          >
            <path
              d={line(
                model.timeline.map((p) => p.demandMw),
                maximum,
              )}
              className="ops-demand"
            />
            <path
              d={line(
                model.timeline.map((p) => p.limitMw),
                maximum,
              )}
              className="ops-limit"
            />
            <path
              d={line(
                model.timeline.map((p) => p.demandMw - p.responseMw),
                maximum,
              )}
              className="ops-net"
            />
          </svg>
          <div className="activation-legend">
            <span className="demand">Demand</span>
            <span className="envelope">Network limit</span>
            <span className="ops-response">Net after response</span>
          </div>
        </article>
        <aside className="operations-side">
          <p className="context-label">Restriction Response</p>
          <strong>{numberFormatter.format(model.responseMw)} MW</strong>
          <span>required flexibility</span>
          <div>
            <BatteryCharging aria-hidden="true" />
            <p>Battery and workload response are simulated. No command was sent.</p>
          </div>
        </aside>
      </div>
      <div className="operations-cards">
        <Status
          icon={<Gauge />}
          label="Telemetry age"
          value={`${model.readiness.staleSeconds}s`}
          ok={model.readiness.staleSeconds <= 60}
        />
        <Status
          icon={<CircleCheck />}
          label="Envelope status"
          value={model.readiness.status.replaceAll("_", " ")}
          ok={model.readiness.status === "within_envelope"}
        />
        <Status
          icon={<LockKeyhole />}
          label="Automatic dispatch"
          value="Not authorized"
          ok={false}
        />
      </div>
      <article className={`control-readiness ${model.readiness.status}`}>
        <header>
          <AlertTriangle aria-hidden="true" />
          <div>
            <p className="context-label">Control Boundary</p>
            <h2>
              {model.readiness.status === "within_envelope"
                ? "Advisory monitoring ready"
                : "Live-control prerequisites incomplete"}
            </h2>
          </div>
          <span>FAIL CLOSED</span>
        </header>
        <p>{model.readiness.recommendedHumanAction}</p>
        {model.readiness.reasons.length ? (
          <ul>
            {model.readiness.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p>
            All snapshot quality gates pass, but this product still authorizes no automatic
            dispatch. An operator-approved EMS integration, safety case and accountable human
            authorization remain external prerequisites.
          </p>
        )}
      </article>
      <article className="operations-events">
        <header>
          <h2>Evidence Event Log</h2>
          <span>{events.length} stored events</span>
        </header>
        {events.length ? (
          events.slice(0, 8).map((event) => (
            <div key={event.id}>
              <span className={`event-dot ${event.evidence_state}`} aria-hidden="true" />
              <div>
                <strong>{event.kind.replaceAll("_", " ")}</strong>
                <p>
                  {event.organization} · {event.evidence_state.replaceAll("_", " ")}
                </p>
              </div>
              <time dateTime={event.valid_from}>
                {dateTimeFormatter.format(new Date(event.valid_from))}
              </time>
            </div>
          ))
        ) : (
          <p>
            No integration events are stored. The workspace is showing an illustrative simulation.
          </p>
        )}
      </article>
    </section>
  );
}
function Status({
  icon,
  label,
  value,
  ok,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <article className={ok ? "ok" : "blocked"}>
      <span aria-hidden="true">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
