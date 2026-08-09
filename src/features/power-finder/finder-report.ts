import type { PowerFinderCollection } from "./fixture-data";
import { voltageFitLabels, type CandidateOpportunity } from "./candidate-intelligence";
import { finderProjectTypes, projectOperatorQuestions, type FinderProject } from "./finder-project";
import { ruleReferencesForVoltage } from "./german-rules-registry";
import { calculationClassLabels } from "./calculation-provenance";
import {
  activationStatusLabel,
  calculateRepresentativeCommercialValue,
  createActivationStudyContext,
} from "./activation-study";

const clean = (value: unknown) => String(value ?? "Not established").replace(/[^ -~]/g, "-");
const reportDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export async function downloadFinderReport(
  project: FinderProject,
  candidates: CandidateOpportunity[],
  collection: PowerFinderCollection,
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const margin = 18;
  const usable = 174;
  let y = 22;
  const ensure = (space: number) => {
    if (y + space <= 278) return;
    pdf.addPage();
    y = 20;
  };
  const heading = (title: string) => {
    ensure(15);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(4, 160, 195);
    pdf.text(clean(title), margin, y);
    y += 9;
  };
  const line = (label: string, value: unknown) => {
    const wrapped = pdf.splitTextToSize(clean(value), 120) as string[];
    ensure(Math.max(8, wrapped.length * 4.5 + 2));
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(55, 70, 80);
    pdf.text(clean(label), margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(15, 25, 32);
    pdf.text(wrapped, margin + 54, y);
    y += Math.max(7, wrapped.length * 4.5 + 2);
  };

  pdf.setFillColor(3, 14, 21);
  pdf.rect(0, 0, 210, 297, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("GRIDPULSE POWER FINDER", margin, 27);
  pdf.setFontSize(25);
  pdf.text("Screening report", margin, 58);
  pdf.setFontSize(16);
  pdf.text(clean(project.name), margin, 72);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(160, 190, 202);
  pdf.text("Public-source context - not a connection offer", margin, 88);
  pdf.text(`Generated ${reportDate.format(new Date())}`, margin, 98);
  pdf.addPage();
  y = 20;

  heading("1. Declared project");
  line("Project type", finderProjectTypes[project.type].label);
  line(
    "Location",
    project.latitude == null
      ? "Not placed"
      : `${project.latitude.toFixed(6)}, ${project.longitude?.toFixed(6)}`,
  );
  line("Requested import", `${project.importMw} MW`);
  line("Ultimate import", `${project.ultimateImportMw} MW`);
  line("Minimum firm supply", `${project.minimumFirmMw} MW`);
  line("Interruptible load", `${project.flexibleLoadMw} MW`);
  line("Requested export", `${project.exportMw} MW`);
  line("Target energisation", project.targetEnergisationYear);
  line("Redundancy", project.redundancy.replaceAll("_", " "));
  line("Representative load shape", project.loadProfile.replaceAll("_", " "));
  line("Annual consumption", `${project.annualConsumptionGwh} GWh`);
  line("On-site generation", `${project.onsiteGenerationMw} MW`);
  if (project.batteryPowerMw)
    line("Battery", `${project.batteryPowerMw} MW / ${project.batteryEnergyMwh} MWh`);
  line("Search radius", `${project.maxDistanceKm} km`);

  heading("2. Investigation-priority candidates");
  if (!candidates.length) line("Result", "No candidates selected for comparison.");
  candidates.forEach((candidate, index) => {
    const activation = createActivationStudyContext({
      project,
      candidate,
      registeredStudy: null,
    });
    line(`${index + 1}. Candidate`, `${candidate.nodeName} - ${candidate.distanceKm} km`);
    line(
      "Investigation priority",
      `${candidate.screeningRank}/100 GridPulse screening rule; ${voltageFitLabels[candidate.voltageFit]}; ${candidate.confidence} evidence readiness`,
    );
    line(
      "Calculation class",
      calculationClassLabels[candidate.provenance?.calculationClass ?? "heuristic"],
    );
    line("Method version", candidate.provenance?.methodVersion ?? candidate.calculationVersion);
    line("Operator", candidate.operator ?? "Confirmation required");
    line(
      "Activation Study boundary",
      "Representative synthetic benchmark—not calculated capacity at this mapped node.",
    );
    const recommended = activation.recommendedOption;
    const commercial = calculateRepresentativeCommercialValue(activation);
    line("Leading representative pathway", recommended?.title ?? "Not established");
    if (recommended) {
      line("Strategy interpretation", activationStatusLabel(recommended.operationalStatus));
      line(
        "Initial / eventual benchmark",
        `${recommended.initialImportMw.toFixed(1)} MW / ${recommended.eventualImportMw.toFixed(1)} MW`,
      );
      line(
        "Hourly benchmark",
        `${recommended.analysis?.restrictedHours ?? "unavailable"} restricted hours; ${recommended.analysis?.residualUnservedMwh ?? "unavailable"} MWh residual energy; ${recommended.analysis?.demandServedPercent ?? "unavailable"}% demand served`,
      );
      line("Recommended validation action", recommended.nextAction);
    }
    activation.decisionMatrix.forEach((option) =>
      line(
        `Activation option — ${option.title}`,
        `${option.initialImportMw.toFixed(1)} MW initial; ${option.eventualImportMw.toFixed(1)} MW eventual; ${option.analysis?.restrictedHours ?? "unavailable"} restricted hours in the representative profile; ${option.evidenceStatus.replaceAll("_", " ")}`,
      ),
    );
    line(
      "Representative commercial sensitivity",
      `EUR ${Math.round(commercial.lowIndicativeValueEur).toLocaleString("en-GB")} low / EUR ${Math.round(commercial.netIndicativeValueEur).toLocaleString("en-GB")} base / EUR ${Math.round(commercial.highIndicativeValueEur).toLocaleString("en-GB")} high`,
    );
    line("Commercial boundary", commercial.boundary);
    if (candidate.capacityScenario) {
      line(
        "EXPERIMENTAL DEMONSTRATION — NOT GRID CAPACITY",
        `${candidate.capacityScenario.firmImportEnvelopeMw} MW demonstration import assumption; ${candidate.capacityScenario.flexibleImportEnvelopeMw} MW demonstration flexible-import profile; ${candidate.capacityScenario.syntheticExportEnvelopeMw} MW demonstration export assumption; ${candidate.capacityScenario.constrainedHoursPerYear} demonstration shortfall hours/year`,
      );
      line("Assumed limiting component", candidate.capacityScenario.limitingComponent);
      line(
        "Scenario provenance",
        `${candidate.capacityScenario.scenarioVersion}; ${candidate.capacityScenario.modelVersion}; untrained; not for a connection decision`,
      );
    }
    if (candidate.networkScenario) {
      line(
        "EXPERIMENTAL REFERENCE-NETWORK DEMONSTRATION",
        `${candidate.networkScenario.n0TransferLimitMw} MW base-case demonstration; ${candidate.networkScenario.n1TransferLimitMw} MW outage-case demonstration; ${candidate.networkScenario.selectedSecurityLimitMw} MW selected demonstration; ${candidate.networkScenario.residualSecurityMarginMw} MW requirement difference`,
      );
      line(
        "Demonstration assumptions",
        `${candidate.networkScenario.bindingConstraint}; ${candidate.networkScenario.voltageProxyPu} p.u. demonstration voltage indicator; ${candidate.networkScenario.securityScore}/100 demonstration score`,
      );
      line(
        "Experimental model provenance",
        `${candidate.networkScenario.networkVersion}; unvalidated reference model; not AC/DC power flow; not for a connection decision`,
      );
      candidate.networkScenario.sensitivities.forEach((sensitivity) =>
        line(
          `Sensitivity — ${sensitivity.label}`,
          `${sensitivity.transferLimitMw} MW; ${sensitivity.residualMarginMw} MW difference; ${sensitivity.bindingConstraint}; ${sensitivity.passesDeclaredFirmRequirement ? "meets" : "does not meet"} demonstration assumption`,
        ),
      );
    }
    line("Missing evidence", candidate.missingEvidence.join(", "));
    ruleReferencesForVoltage(candidate.voltageKv).forEach((rule) =>
      line(rule.title, `${rule.publicSummary} ${rule.url}`),
    );
  });

  heading("3. Questions for the network operator");
  projectOperatorQuestions(project).forEach((question, index) => line(`${index + 1}`, question));

  heading("4. Method, sources and limitations");
  line("Publisher", collection.metadata.publisher);
  line("Source freshness", collection.metadata.freshness);
  line("Attribution", collection.metadata.attribution);
  line("Evidence boundary", collection.metadata.evidence_boundary);
  line(
    "Capacity",
    "The public report does not calculate available, reserved or connectable capacity at a mapped node. Activation Study values are watermarked representative assumptions and remain separate from operator-model or operator-confirmed results.",
  );
  line(
    "Decision",
    "The responsible network operator controls feasibility, connection point, restrictions, cost, and timing.",
  );
  pdf.setFontSize(7);
  pdf.setTextColor(90, 110, 120);
  pdf.text(
    pdf.splitTextToSize(
      "Generated locally in the browser. Customer-declared inputs are not operator evidence.",
      usable,
    ),
    margin,
    288,
  );
  pdf.save(`${clean(project.name).replace(/\s+/g, "-").toLowerCase()}-finder-screening.pdf`);
}
