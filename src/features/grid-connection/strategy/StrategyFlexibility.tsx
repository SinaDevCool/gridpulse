import { Info, ShieldAlert, Zap } from "lucide-react";
import type { StrategyControllerContract } from "./controller-contract";
export function StrategyFlexibility({ model }: { model: StrategyControllerContract }) {
  const {
    busy,
    intervalResult,
    input,
    result,
    specificationValidation,
    analyse,
    saveFlexibility,
    runIntervalSimulation,
    profiles,
  } = model;
  return (
    <div className="flexibility-layout">
      <form className="strategy-form" onSubmit={analyse}>
        <h3>Declared operating envelope</h3>
        {[
          ["requestedImportMw", "Requested import", input.requestedImportMw],
          ["firmImportMw", "Firm import", input.firmImportMw],
          ["conditionalImportMw", "Conditional additional import", input.conditionalImportMw],
          ["minimumCriticalLoadMw", "Minimum critical load", input.minimumCriticalLoadMw],
          ["shiftableLoadMw", "Shiftable workload", input.shiftableLoadMw],
          ["batteryPowerMw", "Battery power", input.batteryPowerMw],
          ["batteryEnergyMwh", "Battery energy (MWh)", input.batteryEnergyMwh],
          [
            "restrictionDurationHours",
            "Restriction duration (hours)",
            input.restrictionDurationHours,
          ],
          ["restrictionEventsPerYear", "Events per year", input.restrictionEventsPerYear],
          ["maximumEventsPerDay", "Maximum events per day", input.maximumEventsPerDay],
          ["recoveryHours", "Recovery between events (hours)", input.recoveryHours],
          ["geographicTransferMw", "Transferable workload", input.geographicTransferMw],
          ["notificationLeadMinutes", "Notification lead (minutes)", input.notificationLeadMinutes],
          ["rampDownMwPerMinute", "Ramp-down rate (MW/min)", input.rampDownMwPerMinute],
          ["rampUpMwPerMinute", "Ramp-up rate (MW/min)", input.rampUpMwPerMinute],
          ["upsPowerMw", "UPS power", input.upsPowerMw],
          ["upsEnergyMwh", "UPS energy (MWh)", input.upsEnergyMwh],
          ["generatorPowerMw", "Generator power", input.generatorPowerMw],
          ["generatorMaxHoursYear", "Generator maximum hours/year", input.generatorMaxHoursYear],
          [
            "batteryRoundTripEfficiency",
            "Battery efficiency (0–1)",
            input.batteryRoundTripEfficiency,
          ],
          ["batteryMinimumSoc", "Battery minimum SOC (0–1)", input.batteryMinimumSoc],
          ["initialBatterySoc", "Initial battery SOC (0–1)", input.initialBatterySoc],
          ["energyValueEurMwh", "Unserved-energy value (EUR/MWh)", input.energyValueEurMwh],
          [
            "batteryDegradationEurMwh",
            "Battery degradation (EUR/MWh)",
            input.batteryDegradationEurMwh,
          ],
        ].map(([name, label, value]) => (
          <label key={String(name)}>
            {label}
            <input
              type="number"
              min="0"
              step="0.1"
              name={String(name)}
              defaultValue={Number(value)}
            />
          </label>
        ))}
        <button className="primary-button" type="submit">
          <Zap /> Recalculate envelope
        </button>
      </form>
      <article className="strategy-card result-card">
        <p className="context-label">Deterministic result · {result.calculationVersion}</p>
        <h3>
          {result.compatible ? "Compatible on declared inputs" : "Envelope leaves a shortfall"}
        </h3>
        <dl className="strategy-facts">
          <div>
            <dt>Gross shortfall</dt>
            <dd>{result.grossShortfallMw} MW</dd>
          </div>
          <div>
            <dt>Workload contribution</dt>
            <dd>{result.shiftableContributionMw} MW</dd>
          </div>
          <div>
            <dt>Battery contribution</dt>
            <dd>{result.batteryContributionMw} MW</dd>
          </div>
          <div>
            <dt>Residual shortfall</dt>
            <dd>{result.residualShortfallMw} MW</dd>
          </div>
          <div>
            <dt>Annual constrained energy</dt>
            <dd>{result.annualConstrainedEnergyMwh} MWh</dd>
          </div>
          <div>
            <dt>Modelled annual exposure</dt>
            <dd>€{result.estimatedAnnualExposureEur.toLocaleString("en-GB")}</dd>
          </div>
          <div>
            <dt>Dispatchable resources</dt>
            <dd>{specificationValidation.derived.dispatchablePowerMw} MW</dd>
          </div>
          <div>
            <dt>Usable battery duration</dt>
            <dd>{specificationValidation.derived.batteryDurationHours} h</dd>
          </div>
        </dl>
        {specificationValidation.blockers.map((blocker) => (
          <p className="model-warning" key={blocker}>
            <ShieldAlert />
            Blocking inconsistency: {blocker}
          </p>
        ))}
        {specificationValidation.warnings.map((warning) => (
          <p className="model-warning" key={warning}>
            <Info />
            {warning}
          </p>
        ))}
        {result.warnings.map((warning) => (
          <p className="model-warning" key={warning}>
            <Info />
            {warning}
          </p>
        ))}
        <button
          onClick={saveFlexibility}
          disabled={busy || specificationValidation.blockers.length > 0}
        >
          Save analysis
        </button>
        <button onClick={runIntervalSimulation} disabled={busy || !profiles.length}>
          <Zap /> Run 15-minute profile simulation
        </button>
        {intervalResult ? (
          <div className="interval-result">
            <p className="context-label">Interval result · {intervalResult.calculationVersion}</p>
            <div className="interval-metrics">
              <span>
                <b>{intervalResult.demandServedPercent}%</b> demand served
              </span>
              <span>
                <b>{intervalResult.restrictedHours} h</b> restricted
              </span>
              <span>
                <b>{intervalResult.residualUnservedMwh} MWh</b> residual
              </span>
              <span>
                <b>€{intervalResult.estimatedAnnualExposureEur.toLocaleString("en-GB")}</b> exposure
              </span>
            </div>
            <div className="dispatch-chart" aria-label="Recent interval dispatch result">
              {intervalResult.timeline.slice(0, 96).map((point) => (
                <i
                  key={point.timestamp}
                  style={{
                    height: `${Math.min(100, point.baselineImportMw ? (point.residualShortfallMw / point.baselineImportMw) * 100 : 0)}%`,
                  }}
                  title={`${point.timestamp}: ${point.residualShortfallMw} MW residual`}
                />
              ))}
            </div>
          </div>
        ) : null}
      </article>
    </div>
  );
}
