export type ChartDatum = { label: string; value: number | null; color?: string; note?: string };

const number = new Intl.NumberFormat("en-DE", { maximumFractionDigits: 1 });

export function WaterfallChart({
  title,
  unit,
  items,
}: {
  title: string;
  unit: string;
  items: ChartDatum[];
}) {
  const known = items.filter((item): item is ChartDatum & { value: number } => item.value !== null);
  const maximum = Math.max(1, ...known.map((item) => Math.abs(item.value)));
  return (
    <figure className="dca-chart" aria-label={title}>
      <figcaption>{title}</figcaption>
      <div className="dca-waterfall">
        {items.map((item, index) => (
          <div className="dca-waterfall-item" key={item.label}>
            <div className="dca-waterfall-value">
              {item.value === null ? "Missing" : `${number.format(item.value)} ${unit}`}
            </div>
            <div className={`dca-waterfall-track ${item.value === null ? "missing" : ""}`}>
              {item.value !== null && (
                <i
                  style={{
                    height: `${Math.max(14, (Math.abs(item.value) / maximum) * 100)}%`,
                    background: item.color,
                  }}
                />
              )}
            </div>
            <strong>{item.label}</strong>
            {item.note && <small>{item.note}</small>}
            {index < items.length - 1 && <b aria-hidden="true">→</b>}
          </div>
        ))}
      </div>
      <DataTable items={items} unit={unit} />
    </figure>
  );
}

export function BarComparison({
  title,
  unit,
  items,
}: {
  title: string;
  unit: string;
  items: ChartDatum[];
}) {
  const maximum = Math.max(1, ...items.map((item) => item.value ?? 0));
  return (
    <figure className="dca-chart" aria-label={title}>
      <figcaption>{title}</figcaption>
      <div className="dca-bars">
        {items.map((item) => (
          <div className="dca-bar-row" key={item.label}>
            <span>{item.label}</span>
            <div className={item.value === null ? "missing" : ""}>
              {item.value !== null && (
                <i style={{ width: `${(item.value / maximum) * 100}%`, background: item.color }} />
              )}
            </div>
            <strong>
              {item.value === null ? "Missing" : `${number.format(item.value)} ${unit}`}
            </strong>
          </div>
        ))}
      </div>
      <DataTable items={items} unit={unit} />
    </figure>
  );
}

export function SensitivityMatrix({
  title,
  rows,
  columns,
  calculate,
}: {
  title: string;
  rows: number[];
  columns: number[];
  calculate: (row: number, column: number) => number;
}) {
  const values = rows.flatMap((row) => columns.map((column) => calculate(row, column)));
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return (
    <figure className="dca-chart dca-matrix" aria-label={title}>
      <figcaption>{title}</figcaption>
      <table>
        <thead>
          <tr>
            <th scope="col">PUE \ €/MWh</th>
            {columns.map((column) => (
              <th scope="col" key={column}>
                {eur(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row}>
              <th scope="row">{row.toFixed(2)}</th>
              {columns.map((column) => {
                const value = calculate(row, column);
                const ratio = maximum === minimum ? 0 : (value - minimum) / (maximum - minimum);
                return (
                  <td
                    key={column}
                    style={{ background: `rgba(73, 211, 255, ${0.08 + ratio * 0.32})` }}
                  >
                    {compactEur(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function EvidenceLegend() {
  return (
    <div className="dca-evidence-legend" aria-label="Evidence legend">
      <span>
        <i className="calculated" />
        Calculated
      </span>
      <span>
        <i className="public" />
        Public report
      </span>
      <span>
        <i className="entered" />
        Customer / supplier input
      </span>
      <span>
        <i className="missing" />
        Missing evidence
      </span>
    </div>
  );
}

function DataTable({ items, unit }: { items: ChartDatum[]; unit: string }) {
  return (
    <details className="dca-chart-data">
      <summary>View chart data</summary>
      <table>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">Value</th>
            <th scope="col">Note</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.label}>
              <th scope="row">{item.label}</th>
              <td>{item.value === null ? "Missing" : `${number.format(item.value)} ${unit}`}</td>
              <td>{item.note ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
const eur = (value: number) =>
  new Intl.NumberFormat("en-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
const compactEur = (value: number) =>
  new Intl.NumberFormat("en-DE", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
