import type { OperationsOverviewModel } from "../scenario-engine";
import { formatOperationsTime } from "../presentation";
export function AssessmentRecord({
  fullModel,
  assessmentIdentity,
}: {
  fullModel: OperationsOverviewModel;
  assessmentIdentity: { id: string; generatedAt: string } | null;
}) {
  return (
    <details
      id="operations-assurance"
      className="operations-assurance-panel operations-technical-details"
    >
      <summary>Evidence & assumptions · assessment details</summary>
      <p>
        Calculation method: aggregate scenario heuristic—not mathematical optimisation. Overview
        compares responses; Compute screens workload candidates; Power & Battery inspects
        battery-only dispatch. All use the same full-horizon assessment.
      </p>
      <p>
        Aggregate scenario assessment record. Uploaded meter, BMS and workload evidence is listed
        separately in Inputs; this record does not certify those observations. No delivered response
        has been verified.
      </p>
      {fullModel.assessmentPlan ? (
        <>
          <p>
            Shared assessment · synthetic comparison baseline. Accepted evidence:{" "}
            {fullModel.assessmentPlan.evidenceCounts.facility} meter records,{" "}
            {fullModel.assessmentPlan.evidenceCounts.battery} BMS records,{" "}
            {fullModel.assessmentPlan.evidenceCounts.workloads} imported jobs,{" "}
            {fullModel.assessmentPlan.evidenceCounts.telemetry} GPU samples.
          </p>
          <p>
            Power target: {fullModel.assessmentPlan.status.powerTargetMet ? "met" : "not met"}.
            Recovery:{" "}
            {fullModel.assessmentPlan.status.recoveryComplete
              ? "complete in aggregate scenario"
              : "unfinished work"}
            . Job schedule: not validated. Backup autonomy: not established.
          </p>
          <p>
            Configured reserve:{" "}
            {fullModel.assessmentPlan.status.reserveProtected
              ? "protected in simulation"
              : "constraint failed"}
            . Aggregate scenario feasibility:{" "}
            {fullModel.assessmentPlan.status.scenarioFeasible
              ? "passed declared constraints"
              : "not established"}
            .
          </p>
          {fullModel.assessmentPlan.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <details>
            <summary>Canonical planning readiness</summary>
            <ul>
              {fullModel.assessmentPlan.canonical.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
      <p>
        Physical dispatch is locked. Job-level validation, current operating agreements and
        authorised equipment integrations are required before execution.
      </p>
      <p>
        {assessmentIdentity
          ? `Assessment ${assessmentIdentity.id} · Calculated ${formatOperationsTime(assessmentIdentity.generatedAt, true)}`
          : "Calculation pending or browser demonstration—not an operational plan"}
      </p>
      <p>
        Full planning horizon: {fullModel.intervals.length} intervals. Recovery and battery state
        are calculated over this horizon before display-window filtering.
      </p>
      {fullModel.planningTime ? (
        <p>
          Calculation coverage:{" "}
          {formatOperationsTime(fullModel.planningTime.calculation.start, true)} –{" "}
          {formatOperationsTime(fullModel.planningTime.calculation.end, true)}. Purpose: synthetic
          scenario. Terminal policy: report unfinished work, not guaranteed completion. No forward
          forecast or rolling control is enabled.
        </p>
      ) : null}
      <p>
        Transformer, UPS and cooling limits are not independently established by this aggregate
        scenario. Backup autonomy and individual job deadlines are not validated.
      </p>
      <p>
        Cost requires a reviewed tariff and a full-horizon canonical calculation. Reference GPU-hour
        equivalents are not delivered compute.
      </p>
    </details>
  );
}
