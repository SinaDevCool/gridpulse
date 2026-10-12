import { Database,ExternalLink } from "lucide-react";

export const Empty = ({ title, copy }: { title: string; copy: string }) => (
  <div className="dca-empty">
    <Database />
    <h2>{title}</h2>
    <p>{copy}</p>
    <small>Open Inputs & assumptions to continue.</small>
  </div>
);

export const Metric = ({ label, value, note }: { label: string; value: string; note: string }) => (
  <article className="dca-metric">
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{note}</small>
  </article>
);

export function Title({ over, title, copy }: { over: string; title: string; copy: string }) {
  return (
    <div className="dca-title">
      <span>{over}</span>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}

export function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="dca-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function DecisionNote({ title, copy }: { title: string; copy: string }) {
  return (
    <section className="dca-decision-note">
      <div>
        <span>Decision interpretation</span>
        <h3>{title}</h3>
      </div>
      <p>{copy}</p>
    </section>
  );
}

export function Sources() {
  return (
    <div className="dca-sources">
      <h3>Primary reference evidence</h3>
      <a
        href="https://www.energy.gov/cmei/2022-grid-energy-storage-technology-cost-and-performance-assessment"
        target="_blank"
        rel="noreferrer"
      >
        US DOE storage assessment <ExternalLink />
      </a>
      <a
        href="https://www.energy.gov/sites/default/files/2023-07/Technology%20Strategy%20Assessment%20-%20Compressed%20Air%20Energy%20Storage.pdf"
        target="_blank"
        rel="noreferrer"
      >
        US DOE compressed-air assessment <ExternalLink />
      </a>
      <a
        href="https://www.gov.uk/government/publications/storage-at-scale-competition-project-winner/storage-at-scale-project-winner-details"
        target="_blank"
        rel="noreferrer"
      >
        UK Government liquid-air project <ExternalLink />
      </a>
      <a
        href="https://cyprus.representation.ec.europa.eu/news/commission-european-investment-bank-and-breakthrough-energy-catalyst-partnership-funds-first-joint-2023-12-01_en"
        target="_blank"
        rel="noreferrer"
      >
        EC / EIB CO₂ Battery project <ExternalLink />
      </a>
    </div>
  );
}

export function TextField({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: (v: string) => void;
}) {
  const id = `text-${label.replaceAll(" ", "-")}`;
  return (
    <label className="dca-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        name={id}
        autoComplete="off"
        value={value}
        onChange={(e) => change(e.target.value)}
      />
    </label>
  );
}

export function N({
  label,
  unit,
  value,
  change,
}: {
  label: string;
  unit?: string;
  value: number | null;
  change: (v: number | null) => void;
}) {
  const id = `num-${label.replaceAll(" ", "-")}`;
  return (
    <label className="dca-field" htmlFor={id}>
      <span>
        {label}
        <small>{unit}</small>
      </span>
      <input
        id={id}
        name={id}
        type="number"
        inputMode="decimal"
        autoComplete="off"
        min="0"
        value={value ?? ""}
        onChange={(e) => change(e.target.value === "" ? null : Number(e.target.value))}
      />
    </label>
  );
}
