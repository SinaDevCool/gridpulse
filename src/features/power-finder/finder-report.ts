import type { jsPDF as JsPdfDocument } from "jspdf";
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
const reportDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" });
const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const ink = [18, 36, 49] as const;
const muted = [92, 112, 126] as const;
const cyan = [18, 171, 205] as const;
const navy = [5, 20, 32] as const;
const pale = [239, 247, 250] as const;
const amber = [180, 112, 17] as const;

export async function buildFinderReport(
  project: FinderProject,
  candidates: CandidateOpportunity[],
  collection: PowerFinderCollection,
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const margin = 17;
  const pageWidth = 210;
  const pageHeight = 297;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;
  let section = "Screening report";

  const footer = () => {
    const page = pdf.getNumberOfPages();
    pdf.setDrawColor(210, 225, 232);
    pdf.line(margin, 282, pageWidth - margin, 282);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...muted);
    pdf.text("GRIDPULSE - PUBLIC-SOURCE CONNECTION SCREENING", margin, 288);
    pdf.text(`${page}`, pageWidth - margin, 288, { align: "right" });
  };

  const pageHeader = () => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...cyan);
    pdf.text("GRIDPULSE", margin, 11);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...muted);
    pdf.text(clean(section).toUpperCase(), pageWidth - margin, 11, { align: "right" });
    pdf.setDrawColor(210, 225, 232);
    pdf.line(margin, 14, pageWidth - margin, 14);
  };

  const newPage = (nextSection?: string) => {
    footer();
    pdf.addPage();
    if (nextSection) section = nextSection;
    pageHeader();
    y = 24;
  };

  const ensure = (height: number) => {
    if (y + height > 277) newPage();
  };

  const title = (label: string, intro?: string) => {
    section = label;
    ensure(intro ? 28 : 18);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(...ink);
    pdf.text(clean(label), margin, y);
    y += 7;
    if (intro) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...muted);
      const lines = pdf.splitTextToSize(clean(intro), contentWidth) as string[];
      pdf.text(lines, margin, y);
      y += lines.length * 4.2 + 5;
    } else y += 4;
  };

  const callout = (heading: string, body: string, tone: "info" | "warning" = "info") => {
    const lines = pdf.splitTextToSize(clean(body), contentWidth - 12) as string[];
    const height = 13 + lines.length * 4;
    ensure(height + 4);
    const colour = tone === "warning" ? amber : cyan;
    const fill = tone === "warning" ? [255, 247, 232] as const : pale;
    pdf.setFillColor(fill[0], fill[1], fill[2]);
    pdf.setDrawColor(colour[0], colour[1], colour[2]);
    pdf.roundedRect(margin, y, contentWidth, height, 2, 2, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(colour[0], colour[1], colour[2]);
    pdf.text(clean(heading).toUpperCase(), margin + 6, y + 6);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(...ink);
    pdf.text(lines, margin + 6, y + 11);
    y += height + 5;
  };

  const keyValueGrid = (items: Array<[string, unknown]>, columns = 2) => {
    const gap = 5;
    const width = (contentWidth - gap * (columns - 1)) / columns;
    for (let index = 0; index < items.length; index += columns) {
      const row = items.slice(index, index + columns);
      const wrapped = row.map(([, value]) => pdf.splitTextToSize(clean(value), width - 10) as string[]);
      const height = Math.max(18, ...wrapped.map((lines) => 10 + lines.length * 4));
      ensure(height + 3);
      row.forEach(([label], column) => {
        const x = margin + column * (width + gap);
        pdf.setFillColor(247, 250, 252);
        pdf.setDrawColor(222, 232, 237);
        pdf.roundedRect(x, y, width, height, 2, 2, "FD");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.2);
        pdf.setTextColor(...muted);
        pdf.text(clean(label).toUpperCase(), x + 5, y + 6);
        pdf.setFontSize(9.5);
        pdf.setTextColor(...ink);
        pdf.text(wrapped[column], x + 5, y + 12);
      });
      y += height + 3;
    }
    y += 3;
  };

  const paragraph = (body: string, indent = 0) => {
    const lines = pdf.splitTextToSize(clean(body), contentWidth - indent) as string[];
    ensure(lines.length * 4.3 + 5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.7);
    pdf.setTextColor(...ink);
    pdf.text(lines, margin + indent, y);
    y += lines.length * 4.3 + 4;
  };

  const subsection = (label: string) => {
    ensure(13);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    pdf.setTextColor(...ink);
    pdf.text(clean(label), margin, y);
    y += 7;
  };

  // Cover
  pdf.setFillColor(...navy);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  pdf.setFillColor(...cyan);
  pdf.rect(0, 0, 7, pageHeight, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(91, 220, 245);
  pdf.text("GRIDPULSE", 22, 30);
  pdf.setFontSize(30);
  pdf.setTextColor(255, 255, 255);
  pdf.text("Grid connection", 22, 72);
  pdf.text("screening report", 22, 84);
  pdf.setFontSize(16);
  pdf.setTextColor(207, 229, 237);
  pdf.text(pdf.splitTextToSize(clean(project.name), 160), 22, 104);
  pdf.setDrawColor(55, 91, 110);
  pdf.line(22, 128, 188, 128);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(154, 187, 201);
  pdf.text(`Prepared ${reportDate.format(new Date())}`, 22, 141);
  pdf.text(`${finderProjectTypes[project.type].label} - ${number.format(project.importMw)} MW import`, 22, 149);
  pdf.text(`${candidates.length} investigation-priority candidate${candidates.length === 1 ? "" : "s"}`, 22, 157);
  pdf.setFillColor(17, 42, 57);
  pdf.roundedRect(22, 228, 166, 34, 3, 3, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(91, 220, 245);
  pdf.text("SCREENING BOUNDARY", 30, 239);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(229, 240, 244);
  pdf.text(pdf.splitTextToSize("Public-source context for investigation prioritisation. Not a connection offer, capacity reservation, feasibility decision or delivery commitment.", 148), 30, 247);

  pdf.addPage();
  pageHeader();
  y = 24;

  title("Executive summary", "A concise decision view of the declared demand, shortlist and evidence gaps.");
  keyValueGrid([
    ["Requested import", `${number.format(project.importMw)} MW`],
    ["Search radius", `${number.format(project.maxDistanceKm)} km`],
    ["Candidates reviewed", candidates.length],
    ["Data freshness", collection.metadata.freshness],
  ]);
  callout("What this report supports", "Prioritising mapped connection points for operator engagement using proximity, voltage context and evidence readiness.");
  callout("What remains unknown", "Available or reserved capacity, feasibility, reinforcement scope, cost and energisation timing require confirmation by the responsible network operator.", "warning");

  subsection("Shortlist at a glance");
  if (!candidates.length) paragraph("No candidates were selected for comparison.");
  candidates.slice(0, 6).forEach((candidate, index) => {
    ensure(18);
    pdf.setFillColor(index % 2 ? 247 : 239, index % 2 ? 250 : 247, index % 2 ? 252 : 250);
    pdf.rect(margin, y - 4, contentWidth, 16, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...ink);
    pdf.text(`${index + 1}. ${clean(candidate.nodeName)}`, margin + 4, y + 1);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...muted);
    pdf.text(`${number.format(candidate.distanceKm)} km`, 142, y + 1);
    pdf.text(`${number.format(candidate.screeningRank)}/100`, 190, y + 1, { align: "right" });
    pdf.text(`${clean(voltageFitLabels[candidate.voltageFit])} - ${clean(candidate.confidence)} evidence`, margin + 4, y + 7);
    y += 17;
  });

  title("1. Declared project", "Inputs supplied by the user and used to define the screening context.");
  keyValueGrid([
    ["Project type", finderProjectTypes[project.type].label],
    ["Location", project.latitude == null ? "Not placed" : `${project.latitude.toFixed(5)}, ${project.longitude?.toFixed(5)}`],
    ["Requested / ultimate import", `${number.format(project.importMw)} / ${number.format(project.ultimateImportMw)} MW`],
    ["Minimum firm supply", `${number.format(project.minimumFirmMw)} MW`],
    ["Flexible load", `${number.format(project.flexibleLoadMw)} MW`],
    ["Requested export", `${number.format(project.exportMw)} MW`],
    ["Target energisation", project.targetEnergisationYear],
    ["Redundancy", project.redundancy.replaceAll("_", " ")],
    ["Load shape", project.loadProfile.replaceAll("_", " ")],
    ["Annual consumption", `${number.format(project.annualConsumptionGwh)} GWh`],
    ["On-site generation", `${number.format(project.onsiteGenerationMw)} MW`],
    ["Battery", project.batteryPowerMw ? `${number.format(project.batteryPowerMw)} MW / ${number.format(project.batteryEnergyMwh)} MWh` : "None declared"],
  ]);

  candidates.forEach((candidate, index) => {
    const candidateTitle = `2.${index + 1} Candidate - ${candidate.nodeName}`;
    newPage(candidateTitle);
    title(candidateTitle, "Mapped facts, screening interpretation and representative activation pathways.");
    keyValueGrid([
      ["Investigation priority", `${number.format(candidate.screeningRank)}/100`],
      ["Distance", `${number.format(candidate.distanceKm)} km`],
      ["Voltage fit", voltageFitLabels[candidate.voltageFit]],
      ["Evidence readiness", candidate.confidence],
      ["Operator", candidate.operator ?? "Confirmation required"],
      ["Mapped voltage", candidate.voltageKv.length ? `${candidate.voltageKv.join(" / ")} kV` : "Not mapped"],
    ]);
    callout("Interpretation", "The score ranks investigation context. It does not estimate connection probability or available capacity.", "warning");

    subsection("Method & provenance");
    keyValueGrid([
      ["Calculation class", calculationClassLabels[candidate.provenance?.calculationClass ?? "heuristic"]],
      ["Method version", candidate.provenance?.methodVersion ?? candidate.calculationVersion],
    ]);

    const activation = createActivationStudyContext({ project, candidate, registeredStudy: null });
    const recommended = activation.recommendedOption;
    subsection("Representative activation pathway");
    if (recommended) {
      keyValueGrid([
        ["Leading pathway", recommended.title],
        ["Strategy", activationStatusLabel(recommended.operationalStatus)],
        ["Initial / eventual", `${number.format(recommended.initialImportMw)} / ${number.format(recommended.eventualImportMw)} MW`],
        ["Demand served", `${recommended.analysis?.demandServedPercent ?? "Unavailable"}%`],
        ["Restricted hours", recommended.analysis?.restrictedHours ?? "Unavailable"],
        ["Residual energy", `${recommended.analysis?.residualUnservedMwh ?? "Unavailable"} MWh`],
      ]);
      paragraph(`Next validation action: ${recommended.nextAction}`);
    } else paragraph("No representative pathway is established.");

    const commercial = calculateRepresentativeCommercialValue(activation);
    subsection("Commercial sensitivity - representative only");
    keyValueGrid([
      ["Low", money.format(commercial.lowIndicativeValueEur)],
      ["Base", money.format(commercial.netIndicativeValueEur)],
      ["High", money.format(commercial.highIndicativeValueEur)],
    ], 3);
    paragraph(commercial.boundary);

    if (candidate.capacityScenario || candidate.networkScenario) {
      callout("Experimental modelling", "The following values are synthetic demonstration assumptions. They are not measured or operator-confirmed capacity at this node.", "warning");
      if (candidate.capacityScenario) keyValueGrid([
        ["Firm demonstration", `${number.format(candidate.capacityScenario.firmImportEnvelopeMw)} MW`],
        ["Flexible demonstration", `${number.format(candidate.capacityScenario.flexibleImportEnvelopeMw)} MW`],
        ["Assumed constraint", candidate.capacityScenario.limitingComponent],
        ["Model", `${candidate.capacityScenario.scenarioVersion} / ${candidate.capacityScenario.modelVersion}`],
      ]);
      if (candidate.networkScenario) keyValueGrid([
        ["Base / outage case", `${number.format(candidate.networkScenario.n0TransferLimitMw)} / ${number.format(candidate.networkScenario.n1TransferLimitMw)} MW`],
        ["Selected demonstration", `${number.format(candidate.networkScenario.selectedSecurityLimitMw)} MW`],
        ["Binding assumption", candidate.networkScenario.bindingConstraint],
        ["Reference network", candidate.networkScenario.networkVersion],
      ]);
    }

    subsection("Evidence gaps & applicable references");
    paragraph(candidate.missingEvidence.length ? candidate.missingEvidence.join("; ") : "No additional gaps recorded.");
    ruleReferencesForVoltage(candidate.voltageKv).forEach((rule) => {
      paragraph(`${rule.title}: ${rule.publicSummary} ${rule.url}`);
    });
  });

  newPage("3. Questions for the network operator");
  title("3. Questions for the network operator", "Use these questions to structure the first evidence request and avoid treating mapped context as a connection decision.");
  projectOperatorQuestions(project).forEach((question, index) => {
    const lines = pdf.splitTextToSize(clean(question), contentWidth - 15) as string[];
    ensure(lines.length * 4.4 + 9);
    pdf.setFillColor(...pale);
    pdf.circle(margin + 4, y - 1.2, 3.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...cyan);
    pdf.text(String(index + 1), margin + 4, y, { align: "center" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...ink);
    pdf.text(lines, margin + 12, y);
    y += lines.length * 4.4 + 5;
  });

  title("4. Sources, method & limitations");
  keyValueGrid([
    ["Publisher", collection.metadata.publisher],
    ["Freshness", collection.metadata.freshness],
    ["Geographic scope", collection.metadata.geographic_scope],
    ["Records in source", collection.metadata.record_count],
  ]);
  subsection("Attribution");
  paragraph(collection.metadata.attribution);
  subsection("Evidence boundary");
  paragraph(collection.metadata.evidence_boundary);
  callout("Capacity boundary", "This public report does not calculate available, reserved or connectable capacity. Representative Activation Study values remain separate from operator-model or operator-confirmed results.", "warning");
  callout("Decision authority", "The responsible network operator controls feasibility, connection point, restrictions, reinforcement, cost and timing.");
  paragraph("Generated locally in the browser. Customer-declared inputs are not operator evidence.");

  footer();
  return pdf;
}

export async function downloadFinderReport(
  project: FinderProject,
  candidates: CandidateOpportunity[],
  collection: PowerFinderCollection,
) {
  const pdf: JsPdfDocument = await buildFinderReport(project, candidates, collection);
  pdf.save(`${clean(project.name).replace(/\s+/g, "-").toLowerCase()}-finder-screening.pdf`);
}
