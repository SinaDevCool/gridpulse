import { type Dispatch,type SetStateAction } from "react";

import { BarChart3,BatteryCharging,CircleDollarSign,SlidersHorizontal } from "lucide-react";

import { type StorageLcosInput } from "@/features/data-centre-planner/storage-lcos";

import {
BarComparison,
EvidenceLegend,
WaterfallChart,
} from "@/features/data-centre-planner/analytics-charts";

import {
type Design,
type FlexResult,
type TechId,
type TechnologyScenario,
type TechnologyScenarios,
} from "./contracts";

import { TECHNOLOGIES,eur,fmt } from "./presentation";

import { DecisionNote,Empty,Line,N,Sources,TextField,Title } from "./primitives";

export function Flexibility({
  tech,
  setTech,
  scenarios,
  setScenarios,
  results,
  gap,
  design,
}: {
  tech: TechId;
  setTech: Dispatch<SetStateAction<TechId>>;
  scenarios: TechnologyScenarios;
  setScenarios: Dispatch<SetStateAction<TechnologyScenarios>>;
  results: Record<TechId, FlexResult>;
  gap: number | null;
  design: Design;
}) {
  const chosen = TECHNOLOGIES.find((t) => t.id === tech)!;
  const scenario = scenarios[tech];
  const cost = scenario.inputs;
  const result = results[tech];
  const set = (key: keyof StorageLcosInput, value: number | null) =>
    setScenarios((current) => ({
      ...current,
      [tech]: { ...current[tech], inputs: { ...current[tech].inputs, [key]: value } },
    }));
  const updateEvidence = (patch: Partial<TechnologyScenario>) =>
    setScenarios((current) => ({ ...current, [tech]: { ...current[tech], ...patch } }));
  const comparable = TECHNOLOGIES.map((technology) => ({
    technology,
    scenario: scenarios[technology.id],
    result: results[technology.id],
  }));
  return (
    <>
      <Title
        over="Grid & flexibility"
        title="Compare flexibility technology economics"
        copy="Technical evidence describes suitability. Economics use only costs and operating assumptions you enter."
      />
      <EvidenceLegend />
      <article className="dca-card dca-primary-chart">
        <WaterfallChart
          title="Peak connection-gap coverage"
          unit="MW"
          items={[
            {
              label: "Facility peak",
              value: design?.facilityPeakMw ?? null,
              color: "#8b75ff",
              note: "Calculated demand",
            },
            {
              label: "Entered firm offer",
              value: design && gap !== null ? design.facilityPeakMw - gap : null,
              color: "#54d6a6",
              note: "Entered scenario",
            },
            { label: "Peak gap", value: gap, color: "#efb743", note: "Not available capacity" },
            {
              label: `${chosen.name} power`,
              value: cost.powerMw,
              color: "#49d3ff",
              note: "Customer / supplier input",
            },
            {
              label: "Residual instantaneous gap",
              value: gap === null || cost.powerMw === null ? null : Math.max(0, gap - cost.powerMw),
              color: "#f27a8a",
              note: "Chronology not validated",
            },
          ]}
        />
      </article>
      <div className="dca-grid-2 dca-section-gap">
        <article className="dca-card">
          <BarComparison
            title="Installed-cost comparison"
            unit="M€"
            items={comparable.map(({ technology, result }) => ({
              label: technology.name,
              value: result ? result.installedCostEur / 1_000_000 : null,
              color: technology.id === tech ? "#49d3ff" : "#8b75ff",
              note: result ? "Complete entered scenario" : "Missing inputs",
            }))}
          />
        </article>
        <article className="dca-card">
          <BarComparison
            title="Levelized cost of storage"
            unit="€/MWh"
            items={comparable.map(({ technology, result }) => ({
              label: technology.name,
              value: result?.lcosEurPerMwh ?? null,
              color: technology.id === tech ? "#49d3ff" : "#54d6a6",
              note: result ? "Calculated from entered costs" : "Not comparable",
            }))}
          />
        </article>
      </div>
      <div className="dca-flex-layout">
        <aside className="dca-tech-list">
          {TECHNOLOGIES.map((t) => (
            <button
              type="button"
              key={t.id}
              className={tech === t.id ? "active" : ""}
              onClick={() => setTech(t.id)}
            >
              <strong>{t.name}</strong>
              <small>{results[t.id] ? "Comparable · entered evidence" : t.maturity}</small>
            </button>
          ))}
        </aside>
        <section className="dca-flex-main">
          <article className="dca-card dca-tech-summary">
            <header>
              <BatteryCharging />
              <div>
                <span>{chosen.maturity}</span>
                <h3>{chosen.name}</h3>
              </div>
            </header>
            <div>
              <Line label="Duration evidence" value={chosen.duration} />
              <Line label="Site constraint" value={chosen.site} />
              <Line label="Reference class" value={chosen.source} />
            </div>
          </article>
          <div className="dca-grid-2">
            <article className="dca-card">
              <header>
                <SlidersHorizontal />
                <div>
                  <span>Customer / supplier evidence</span>
                  <h3>Project economics inputs</h3>
                </div>
              </header>
              <div className="dca-form-grid">
                {(
                  [
                    ["Power", "MW", "powerMw"],
                    ["Duration", "h", "durationHours"],
                    ["Cycles per year", "", "cyclesPerYear"],
                    ["Round-trip efficiency", "%", "roundTripEfficiencyPct"],
                    ["Power CAPEX", "€/kW", "capexPowerEurPerKw"],
                    ["Energy CAPEX", "€/kWh", "capexEnergyEurPerKwh"],
                    ["Fixed OPEX", "€/kW-y", "fixedOpexEurPerKwYear"],
                    ["Variable OPEX", "€/MWh", "variableOpexEurPerMwh"],
                    ["Charging price", "€/MWh", "chargingEnergyPriceEurPerMwh"],
                    ["Discount rate", "%", "discountRatePct"],
                    ["Economic life", "years", "economicLifeYears"],
                  ] as const
                ).map(([label, unit, key]) => (
                  <N
                    key={key}
                    label={label}
                    unit={unit}
                    value={cost[key]}
                    change={(v) => set(key, v)}
                  />
                ))}
                <label className="dca-field" htmlFor="flex-evidence-type">
                  <span>Evidence type</span>
                  <select
                    id="flex-evidence-type"
                    name="flex-evidence-type"
                    value={scenario.evidenceType}
                    onChange={(event) =>
                      updateEvidence({
                        evidenceType: event.target.value as TechnologyScenario["evidenceType"],
                      })
                    }
                  >
                    <option value="customer_assumption">Customer assumption</option>
                    <option value="supplier_quote">Supplier quotation</option>
                    <option value="published_reference">Published reference</option>
                  </select>
                </label>
                <TextField
                  label="Source or quotation reference"
                  value={scenario.sourceReference}
                  change={(sourceReference) => updateEvidence({ sourceReference })}
                />
                <N
                  label="Price year"
                  value={scenario.priceYear}
                  change={(priceYear) => updateEvidence({ priceYear })}
                />
              </div>
            </article>
            <article className="dca-card dca-result-card">
              <header>
                <CircleDollarSign />
                <div>
                  <span>Comparable result</span>
                  <h3>{result ? `${eur.format(result.lcosEurPerMwh)}/MWh` : "Awaiting inputs"}</h3>
                </div>
              </header>
              {result ? (
                <div className="dca-kpi-list">
                  <Line label="Installed cost" value={eur.format(result.installedCostEur)} />
                  <Line label="Annualized CAPEX" value={eur.format(result.annualizedCapexEur)} />
                  <Line
                    label="Charging energy"
                    value={`${fmt.format(result.annualChargingMwh)} MWh/y`}
                  />
                  <Line label="Annual total cost" value={eur.format(result.annualCostEur)} />
                  <Line
                    label="Power gap coverage"
                    value={
                      gap === null
                        ? "Offer missing"
                        : gap === 0
                          ? "No entered gap"
                          : `${fmt.format(Math.min(100, (cost.powerMw! / gap) * 100))}%`
                    }
                  />
                  <p>
                    LCOS includes entered CAPEX, OPEX and charging losses. Revenues, taxes, grid
                    fees, replacement and residual value remain excluded.
                  </p>
                </div>
              ) : (
                <Empty
                  title="No economic result"
                  copy="Complete every cost, efficiency, use and finance input. GridPulse does not insert mock costs."
                />
              )}
            </article>
          </div>
        </section>
      </div>
      <article className="dca-card dca-comparison-table">
        <header>
          <BarChart3 />
          <div>
            <span>Comparable scenarios</span>
            <h3>Technology decision table</h3>
          </div>
        </header>
        <table>
          <thead>
            <tr>
              <th scope="col">Technology</th>
              <th scope="col">Power</th>
              <th scope="col">Duration</th>
              <th scope="col">Efficiency</th>
              <th scope="col">Installed cost</th>
              <th scope="col">LCOS</th>
              <th scope="col">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {comparable.map(({ technology, scenario: entry, result: entryResult }) => (
              <tr key={technology.id}>
                <th scope="row">{technology.name}</th>
                <td>
                  {entry.inputs.powerMw === null
                    ? "Missing"
                    : `${fmt.format(entry.inputs.powerMw)} MW`}
                </td>
                <td>
                  {entry.inputs.durationHours === null
                    ? "Missing"
                    : `${fmt.format(entry.inputs.durationHours)} h`}
                </td>
                <td>
                  {entry.inputs.roundTripEfficiencyPct === null
                    ? "Missing"
                    : `${fmt.format(entry.inputs.roundTripEfficiencyPct)}%`}
                </td>
                <td>{entryResult ? eur.format(entryResult.installedCostEur) : "Not comparable"}</td>
                <td>
                  {entryResult ? `${eur.format(entryResult.lcosEurPerMwh)}/MWh` : "Not comparable"}
                </td>
                <td>{entry.evidenceType.replaceAll("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      <DecisionNote
        title="Instantaneous coverage is not chronological feasibility"
        copy="Upload a real interval demand profile and obtain a time-varying operator envelope before assessing constrained hours, state of charge, recharge, rebound or service continuity."
      />
      <Sources />
    </>
  );
}
