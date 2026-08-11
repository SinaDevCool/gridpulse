import { useMemo, type ReactNode } from "react";
import { Activity, BatteryCharging, CalendarClock, ChevronDown, ShieldCheck } from "lucide-react";
import type { ActivationEnvelope, ActivationSite } from "./workspace-model";
import { buildActivationWorkspaceModel } from "./workspace-model";

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const integerFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

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
  const model = useMemo(() => buildActivationWorkspaceModel(site, envelopes), [site, envelopes]);
  const maximum = Math.max(1, model.requestedMw);
  return (
    <section className="activation-workspace" aria-label="Power Activation study">
      <div className="activation-status-line">
        <span
          className={`evidence-pill ${model.envelope?.status === "agreed" ? "verified" : "illustrative"}`}
        >
          <ShieldCheck size={14} aria-hidden="true" /> {model.evidenceLabel}
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
            <p className="context-label">Representative Week</p>
            <h2>How the Connection Is Activated</h2>
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
          <p className="context-label">Recommended Operating Strategy</p>
          <h2>Contract Firm Capacity, Activate the Balance Flexibly</h2>
          <p>
            Use the {numberFormatter.format(model.firmMw)} MW floor for critical load and coordinate
            up to {numberFormatter.format(model.flexibleMw)} MW against the current envelope. The
            final step to {numberFormatter.format(model.activatedMw)} MW is supported by the
            declared battery.
          </p>
        </div>
        <strong>{numberFormatter.format(model.flexibleMw - model.firmMw)} MW flexible</strong>
      </div>

      <details className="activation-disclosure">
        <summary className="activation-details-toggle">
          Calculation & Evidence Details
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className="activation-details">
          <Detail
            icon={<CalendarClock />}
            label="Estimated restrictions"
            value={`${integerFormatter.format(model.restrictionHours)} h/year`}
          />
          <Detail
            icon={<BatteryCharging />}
            label="Declared battery"
            value={`${numberFormatter.format(site.bess_power_mw ?? 0)} MW / ${numberFormatter.format(site.bess_energy_mwh ?? 0)} MWh`}
          />
          <Detail
            icon={<Activity />}
            label="Flexible energy potential"
            value={`${integerFormatter.format(model.annualFlexibleMwh)} MWh/year`}
          />
          {model.envelope ? (
            <Detail
              icon={<ShieldCheck />}
              label="Envelope validity"
              value={`${model.envelope.valid_from ? dateFormatter.format(new Date(model.envelope.valid_from)) : "Open"} → ${model.envelope.valid_to ? dateFormatter.format(new Date(model.envelope.valid_to)) : "Open"}`}
            />
          ) : null}
          <p>
            {model.envelope
              ? "The latest versioned envelope is used ahead of planning assumptions. Dates, status and restrictions still require operator validation."
              : "Firm capacity is modelled as 84% of requested power, the flexible band as 95%, and battery support is capped at the declared power. These assumptions are deliberately visible and replaceable."}
          </p>
        </div>
      </details>
      {envelopes.length ? (
        <article className="envelope-history">
          <header>
            <h2>Envelope History</h2>
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
                <span>
                  {item.max_import_mw == null ? "—" : numberFormatter.format(item.max_import_mw)} MW
                </span>
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
        {numberFormatter.format(value)} <small>MW</small>
      </strong>
      <span>{note}</span>
    </article>
  );
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="activation-detail">
      <span aria-hidden="true">{icon}</span>
      <span>
        {label}
        <strong>{value}</strong>
      </span>
    </div>
  );
}
