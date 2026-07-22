import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Gauge,
  MapPinned,
  ShieldAlert,
  Upload,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { AppShell } from "@/components/product/AppShell";
import {
  buildConnectionOptions,
  rankConnectionOptions,
} from "@/features/grid-connection/connection-options";
import { downloadJson } from "@/features/grid-connection/deliverables";
import {
  buildPilotPackage,
  buildProfileQualityReport,
  rankPilotCandidates,
  simulateOperationsEvent,
  type CandidateRecord,
  type ReviewRecord,
} from "@/features/grid-connection/phase45";
import type { IntervalPoint } from "@/lib/fca-engine";

export const Route = createFileRoute("/pilot-ready")({
  head: () => ({
    meta: [
      { title: "Pilot-ready workspace | GridPulse" },
      {
        name: "description",
        content:
          "Pilot-ready German large-load connection workflow with profile QA, location comparison and simulated operations.",
      },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: PilotReadyPage,
});

const candidates: CandidateRecord[] = [
  {
    id: "frankfurt",
    name: "Frankfurt West",
    municipality: "Frankfurt am Main",
    likelyDso: "NRM / confirmation required",
    likelyTso: "Amprion",
    targetVoltageKv: 110,
    maturity: 82,
    evidenceCompleteness: 74,
    flexibilityCompatibility: 78,
    operatorEngagement: "contacted",
    capacityEvidence: "declared",
    blockers: ["Land option requires extension"],
  },
  {
    id: "berlin",
    name: "Berlin South",
    municipality: "Ludwigsfelde",
    likelyDso: "E.DIS Netz / confirmation required",
    likelyTso: "50Hertz",
    targetVoltageKv: 110,
    maturity: 71,
    evidenceCompleteness: 69,
    flexibilityCompatibility: 91,
    operatorEngagement: "screened",
    capacityEvidence: "declared",
    blockers: ["Cable route indicative only"],
  },
  {
    id: "leipzig",
    name: "Leipzig North",
    municipality: "Schkeuditz",
    likelyDso: "MITNETZ STROM / confirmation required",
    likelyTso: "50Hertz",
    targetVoltageKv: 110,
    maturity: 58,
    evidenceCompleteness: 48,
    flexibilityCompatibility: 86,
    operatorEngagement: "not_started",
    capacityEvidence: "declared",
    blockers: ["Target connection route not assessed"],
  },
];

const reviews: ReviewRecord[] = [
  {
    id: "technical",
    role: "technical_reviewer",
    status: "accepted",
    subject: "Interval profile and minimum viable import",
    note: "Accepted for pilot modelling; source remains customer-declared.",
    createdAt: "2027-01-10T10:00:00Z",
  },
  {
    id: "expert",
    role: "grid_expert",
    status: "open",
    subject: "Operator responsibility and FCA assumptions",
    note: "Independent review required before operator engagement.",
    createdAt: "2027-01-11T10:00:00Z",
  },
];

function sampleProfile(): IntervalPoint[] {
  return Array.from({ length: 96 * 14 }, (_, index) => {
    const hour = (index % 96) / 4;
    return {
      timestamp: new Date(Date.UTC(2027, 0, 1, 0, index * 15)).toISOString(),
      importMw: 62 + (hour >= 8 && hour < 20 ? 12 : 3) + 2 * Math.sin(index / 9),
      exportMw: 0,
      flexibleLoadMw: hour >= 8 && hour < 20 ? 12 : 5,
    };
  });
}

function PilotReadyPage() {
  const [canExport, setCanExport] = useState(false);
  const [points, setPoints] = useState<IntervalPoint[]>(sampleProfile);
  const [filename, setFilename] = useState("synthetic-14-day-profile.csv");
  const [importError, setImportError] = useState("");
  const quality = useMemo(() => buildProfileQualityReport(points), [points]);
  const rankedCandidates = useMemo(() => rankPilotCandidates(candidates), []);
  const options = useMemo(
    () =>
      rankConnectionOptions(
        buildConnectionOptions({
          requestedImportMw: 80,
          minimumViableImportMw: 55,
          reducedFirmImportMw: 50,
          conditionalImportMw: 20,
          operatorSupported: false,
          profile: quality.status === "blocked" ? null : points,
          dispatch: {
            minimumCriticalLoadMw: 48,
            shiftableLoadMw: 14,
            batteryPowerMw: 12,
            batteryEnergyMwh: 24,
            batteryRoundTripEfficiency: 0.9,
            batteryMinimumSoc: 0.1,
            initialBatterySoc: 1,
            energyValueEurMwh: 220,
            batteryDegradationEurMwh: 25,
          },
        }),
      ),
    [points, quality.status],
  );
  const operation = simulateOperationsEvent({
    id: "fixture-event-01",
    startsAt: "2027-01-15T17:00:00+01:00",
    durationMinutes: 90,
    baselineMw: 78,
    networkLimitMw: 52,
    batteryResponseMw: 12,
    workloadResponseMw: 10,
    state: "forecast",
  });
  const pilotPackage = useMemo(
    () =>
      buildPilotPackage({
        project: {
          name: "German AI data-centre pilot",
          requestedImportMw: 80,
          minimumViableImportMw: 55,
          rampUp: [40, 60, 80],
          evidenceState: "customer_declared",
        },
        quality,
        candidates: rankedCandidates,
        options: options.map((option) => ({ title: option.title, analysis: option.analysis })),
        reviews,
        metrics: {
          assemblyMinutes: 145,
          evidenceGapsFound: 7,
          assumptionsChallenged: 3,
          candidatesCompared: rankedCandidates.length,
          optionsEvaluated: options.length,
          optionsRejectedBeforeOperator: options.filter(
            (option) => option.operationalStatus === "fails_minimum_viable_capacity",
          ).length,
          reviewCycles: 1,
          operatorClarifications: 0,
        },
      }),
    [options, quality, rankedCandidates],
  );
  useEffect(() => setCanExport(true), []);
  const exportPilotPackage = () =>
    downloadJson("gridpulse-operator-engagement-package.json", pilotPackage);

  async function importProfile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportError("");
    try {
      const { importIntervalFile } = await import("@/features/grid-connection/profile-import");
      setPoints(await importIntervalFile(file));
      setFilename(file.name);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Profile import failed.");
    }
  }

  return (
    <AppShell requireAuth>
      <main id="main-content" className="pilot-ready-page">
        <header className="pilot-ready-hero">
          <div>
            <p>Phase 4.5 / pilot-ready foundation</p>
            <h1>Bring one real load profile. Leave with an inspectable operator conversation.</h1>
            <p>
              This workspace tests customer-side operating compatibility and project readiness. It
              does not infer available network capacity or promise a connection date.
            </p>
          </div>
          <div className="pilot-ready-actions">
            <button type="button" disabled={!canExport} onClick={exportPilotPackage}>
              <Download /> Export pilot package
            </button>
            <Link to="/pilot">Bring a real project</Link>
          </div>
        </header>
        <section className="pilot-truth-strip" aria-label="Pilot truth boundary">
          <ShieldAlert />
          <p>
            <strong>Customer-side model</strong>
            <span>
              Capacity values remain declared or hypothetical until written operator confirmation.
            </span>
          </p>
          <p>
            <strong>Review stage</strong>
            <span>Expert review · 1 unresolved item</span>
          </p>
          <p>
            <strong>Method</strong>
            <span>{pilotPackage.methodologyVersion}</span>
          </p>
        </section>

        <section className="pilot-module" data-testid="profile-import">
          <header>
            <FileSpreadsheet />
            <div>
              <small>01 / Real project ingestion</small>
              <h2>Profile quality before scenario confidence.</h2>
            </div>
          </header>
          <div className="pilot-profile-grid">
            <label className="pilot-upload">
              <Upload />
              <strong>Import CSV or XLSX</strong>
              <span>{filename}</span>
              <input type="file" accept=".csv,.xlsx" onChange={importProfile} />
            </label>
            <div className="pilot-stat">
              <span>Resolution</span>
              <strong>{quality.intervalMinutes} min</strong>
            </div>
            <div className="pilot-stat">
              <span>Intervals</span>
              <strong>{quality.intervalCount.toLocaleString()}</strong>
            </div>
            <div className="pilot-stat">
              <span>Peak import</span>
              <strong>{quality.peakImportMw} MW</strong>
            </div>
            <div className="pilot-stat">
              <span>Load factor</span>
              <strong>{Math.round(quality.loadFactor * 100)}%</strong>
            </div>
            <div className={`pilot-quality ${quality.status}`}>
              <span>Quality</span>
              <strong>{quality.status}</strong>
              <small>{quality.warnings[0] ?? "No blocking data defects."}</small>
            </div>
          </div>
          {importError ? <p className="pilot-error">{importError}</p> : null}
        </section>

        <section className="pilot-module" data-testid="candidate-portfolio">
          <header>
            <MapPinned />
            <div>
              <small>02 / Candidate portfolio</small>
              <h2>Rank readiness, never unconfirmed capacity.</h2>
            </div>
          </header>
          <div className="pilot-candidate-table" role="table">
            <div className="pilot-table-head" role="row">
              <span>Candidate</span>
              <span>Likely responsibility</span>
              <span>Readiness</span>
              <span>Capacity evidence</span>
              <span>Next action</span>
            </div>
            {rankedCandidates.map((candidate) => (
              <div role="row" key={candidate.id}>
                <span>
                  <strong>{candidate.name}</strong>
                  <small>
                    {candidate.municipality} · {candidate.targetVoltageKv} kV
                  </small>
                </span>
                <span>
                  {candidate.likelyDso}
                  <small>{candidate.likelyTso}</small>
                </span>
                <span>
                  <b>{candidate.readinessScore}/100</b>
                  <small>{candidate.band.replaceAll("_", " ")}</small>
                </span>
                <span className="unconfirmed">{candidate.capacityEvidence}</span>
                <span>{candidate.nextAction}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="pilot-module" data-testid="option-laboratory">
          <header>
            <Gauge />
            <div>
              <small>03 / Connection option laboratory</small>
              <h2>Compare firm, staged and flexible paths on the same profile.</h2>
            </div>
          </header>
          <div className="pilot-options-grid">
            {options.map((option, index) => (
              <article key={option.kind}>
                <small>Option {String(index + 1).padStart(2, "0")}</small>
                <h3>{option.title}</h3>
                <strong>{option.initialImportMw} MW initial</strong>
                <dl>
                  <div>
                    <dt>Operational status</dt>
                    <dd>{option.operationalStatus.replaceAll("_", " ")}</dd>
                  </div>
                  <div>
                    <dt>Restricted hours</dt>
                    <dd>{option.analysis?.restrictedHours ?? "Not tested"}</dd>
                  </div>
                  <div>
                    <dt>Residual energy</dt>
                    <dd>{option.analysis?.residualUnservedMwh ?? "—"} MWh</dd>
                  </div>
                  <div>
                    <dt>Evidence</dt>
                    <dd>{option.evidenceStatus.replaceAll("_", " ")}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="pilot-module pilot-operations" data-testid="operations-simulation">
          <header>
            <Activity />
            <div>
              <small>04 / Simulated Power Operations</small>
              <h2>Practice a restriction response without controlling equipment.</h2>
            </div>
          </header>
          <div className="operations-banner">Simulation—not a network instruction</div>
          <div className="operations-flow">
            <div>
              <span>Baseline</span>
              <strong>{operation.baselineMw} MW</strong>
            </div>
            <i>→</i>
            <div>
              <span>Fixture limit</span>
              <strong>{operation.networkLimitMw} MW</strong>
            </div>
            <i>→</i>
            <div>
              <span>Battery + workload</span>
              <strong>{operation.batteryResponseMw + operation.workloadResponseMw} MW</strong>
            </div>
            <i>→</i>
            <div className={operation.compliant ? "pass" : "fail"}>
              <span>Remaining exceedance</span>
              <strong>{operation.remainingExceedanceMw} MW</strong>
            </div>
          </div>
        </section>

        <section className="pilot-two-column">
          <article className="pilot-module" data-testid="review-gates">
            <header>
              <Users />
              <div>
                <small>05 / Review and approvals</small>
                <h2>Resolve challenges before operator-ready status.</h2>
              </div>
            </header>
            {reviews.map((review) => (
              <div className="review-row" key={review.id}>
                <span className={review.status}>
                  {review.status === "accepted" ? <CheckCircle2 /> : <ShieldAlert />}
                </span>
                <p>
                  <strong>{review.subject}</strong>
                  <small>
                    {review.role.replaceAll("_", " ")} · {review.note}
                  </small>
                </p>
              </div>
            ))}
          </article>
          <article className="pilot-module" data-testid="evidence-room">
            <header>
              <FileText />
              <div>
                <small>06 / Evidence room</small>
                <h2>Versioned inputs remain attached to conclusions.</h2>
              </div>
            </header>
            {[
              "Interval load profile · v1",
              "Site plan · v2",
              "Single-line diagram · missing",
              "Operator correspondence · none",
            ].map((item, index) => (
              <div className="evidence-row" key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item}</strong>
                <small>{index < 2 ? "customer-declared" : "required"}</small>
              </div>
            ))}
          </article>
        </section>

        <section className="pilot-module pilot-export" data-testid="operator-package">
          <header>
            <Download />
            <div>
              <small>07 / Operator-engagement package</small>
              <h2>One versioned record for project, evidence, options and open confirmations.</h2>
            </div>
          </header>
          <div>
            <p>
              The export contains the profile-quality report, candidate comparison, connection
              options, review state, pilot metrics and explicit limitations.
            </p>
            <button type="button" disabled={!canExport} onClick={exportPilotPackage}>
              <Download /> Download JSON package
            </button>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
