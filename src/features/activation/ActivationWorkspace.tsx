import { useMemo, useState, type ReactNode } from "react";
import { Activity, BatteryCharging, CalendarClock, ChevronDown, ShieldCheck } from "lucide-react";
import type { ActivationEnvelope, ActivationSite } from "./workspace-model";
import { buildActivationWorkspaceModel } from "./workspace-model";

function path(values: number[], maximum: number) {
  return values
    .map(
      (value, index) =>
        `${index ? "L" : "M"} ${(index / (values.length - 1)) * 1000} ${240 - (value / maximum) * 210}`,
    )
    .join(" ");
}

export function ActivationWorkspace({
  site,
  envelopes,
}: {
  site: ActivationSite;
  envelopes: ActivationEnvelope[];
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const model = useMemo(() => buildActivationWorkspaceModel(site, envelopes), [site, envelopes]);
  const maximum = Math.max(1, model.requestedMw);
  return (
    <section className="activation-workspace" aria-label="Power Activation study">
      <div className="activation-status-line">
        <span
          className={`evidence-pill ${model.envelope?.status === "agreed" ? "verified" : "illustrative"}`}
        >
          <ShieldCheck size={14} /> {model.evidenceLabel}
        </span>
        <span>{model.evidenceDetail}</span>
      </div>

      <div className="activation-kpis">
        <Metric label="Requested" value={model.requestedMw} note="Customer target" />
        <Metric label="Firm" value={model.firmMw} note="Always-on baseline" />
        <Metric label="Flexible" value={model.flexibleMw} note="Conditional envelope" accent />
        <Metric label="Activated" value={model.activatedMw} note="With on-site flexibility" />
      </div>

      <article className="activation-chart-card">
        <header>
          <div>
            <p className="context-label">Representative week</p>
            <h2>How the connection is activated</h2>
          </div>
          <div className="activation-legend">
            <span className="demand">Demand</span>
            <span className="envelope">Flexible envelope</span>
            <span className="firm">Firm floor</span>
          </div>
        </header>
        <svg
          viewBox="0 0 1000 260"
          role="img"
          aria-label="Demand, flexible envelope, firm capacity and activated demand over one representative week"
        >
          {[0, 1, 2, 3, 4].map((line) => (
            <line
              key={line}
              x1="0"
              x2="1000"
              y1={30 + line * 52}
              y2={30 + line * 52}
              className="chart-grid"
            />
          ))}
          <path
            d={path(
              model.timeline.map((point) => point.flexibleMw),
              maximum,
            )}
            className="chart-envelope"
          />
          <path
            d={path(
              model.timeline.map((point) => point.firmMw),
              maximum,
            )}
            className="chart-firm"
          />
          <path
            d={path(
              model.timeline.map((point) => point.requestedMw),
              maximum,
            )}
            className="chart-demand"
          />
          <path
            d={path(
              model.timeline.map((point) => point.activatedMw),
              maximum,
            )}
            className="chart-activated"
          />
        </svg>
        <div className="chart-days">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span>Sun</span>
        </div>
      </article>

      <div className="activation-recommendation">
        <Activity aria-hidden="true" />
        <div>
          <p className="context-label">Recommended operating strategy</p>
          <h2>Contract firm capacity, activate the balance flexibly</h2>
          <p>
            Use the {model.firmMw.toFixed(0)} MW floor for critical load and coordinate up to{" "}
            {model.flexibleMw.toFixed(0)} MW against the current envelope. The final step to{" "}
            {model.activatedMw.toFixed(0)} MW is supported by the declared battery.
          </p>
        </div>
        <strong>{(model.flexibleMw - model.firmMw).toFixed(0)} MW flexible</strong>
      </div>

      <button
        type="button"
        className="activation-details-toggle"
        onClick={() => setDetailsOpen((value) => !value)}
        aria-expanded={detailsOpen}
      >
        Calculation and evidence details{" "}
        <ChevronDown className={detailsOpen ? "rotated" : undefined} />
      </button>
      {detailsOpen ? (
        <div className="activation-details">
          <Detail
            icon={<CalendarClock />}
            label="Estimated restrictions"
            value={`${model.restrictionHours} h/year`}
          />
          <Detail
            icon={<BatteryCharging />}
            label="Declared battery"
            value={`${site.bess_power_mw ?? 0} MW / ${site.bess_energy_mwh ?? 0} MWh`}
          />
          <Detail
            icon={<Activity />}
            label="Flexible energy potential"
            value={`${model.annualFlexibleMwh.toLocaleString()} MWh/year`}
          />
          {model.envelope ? (
            <Detail
              icon={<ShieldCheck />}
              label="Envelope validity"
              value={`${model.envelope.valid_from ? new Date(model.envelope.valid_from).toLocaleDateString() : "Open"} → ${model.envelope.valid_to ? new Date(model.envelope.valid_to).toLocaleDateString() : "Open"}`}
            />
          ) : null}
          <p>
            {model.envelope
              ? "The latest versioned envelope is used ahead of planning assumptions. Dates, status and restrictions still require operator validation."
              : "Firm capacity is modelled as 84% of requested power, the flexible band as 95%, and battery support is capped at the declared power. These assumptions are deliberately visible and replaceable."}
          </p>
        </div>
      ) : null}
      {envelopes.length ? (
        <article className="envelope-history">
          <header>
            <h2>Envelope history</h2>
            <span>Latest version is applied automatically</span>
          </header>
          {[...envelopes]
            .sort((a, b) => b.version - a.version)
            .map((item) => (
              <div key={item.id}>
                <strong>
                  v{item.version} · {item.name}
                </strong>
                <span>
                  {item.mode} · {item.status}
                </span>
                <span>{item.max_import_mw ?? "—"} MW</span>
              </div>
            ))}
        </article>
      ) : null}
    </section>
  );
}

function Metric({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: number;
  note: string;
  accent?: boolean;
}) {
  return (
    <article className={accent ? "accent" : undefined}>
      <p>{label}</p>
      <strong>
        {value.toFixed(0)} <small>MW</small>
      </strong>
      <span>{note}</span>
    </article>
  );
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="activation-detail">
      {icon}
      <span>
        {label}
        <strong>{value}</strong>
      </span>
    </div>
  );
}
