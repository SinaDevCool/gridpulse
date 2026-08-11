import { jsPDF } from "jspdf";
import type { AnonymousProperty, AnonymousWorkspaceSettings } from "../anonymous-workspace/schema";
import {
  deriveQualification,
  decisionRecommendationLabel,
  qualificationLabels,
} from "../anonymous-workspace/data-centre-qualification";
import { projectAnonymousProperty } from "../anonymous-workspace/portfolio-projection";
import type { CapacityDossierProjection } from "./capacity-dossier";
import { capacityValue } from "./capacity-dossier";

export function buildDecisionPackageProjection(
  property: AnonymousProperty,
  dossier: CapacityDossierProjection,
  settings: AnonymousWorkspaceSettings,
) {
  return {
    schema: "gridpulse.site-decision-package.v1",
    generatedAt: new Date().toISOString(),
    settings,
    property,
    dossier,
    summary: projectAnonymousProperty(property),
    qualification: deriveQualification(property),
    truthNotice:
      "Preliminary decision support. Grid screening does not establish capacity, feasibility, cost, connection point or delivery date. Only current validated operator evidence may support confirmed claims.",
  };
}

export function downloadClientDecisionPackage(
  property: AnonymousProperty,
  dossier: CapacityDossierProjection,
  settings: AnonymousWorkspaceSettings,
) {
  const data = buildDecisionPackageProjection(property, dossier, settings);
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const navy = "#071722",
    ink = "#122634",
    muted = "#637b89",
    border = "#d7e2e8";
  const accent = settings.accentColour || "#22c7e6";
  const cleanPdfText = (value: unknown, fallback = "Not established") =>
    (value == null || value === "" ? fallback : String(value))
      .replaceAll("_", " ")
      .replace(/[\u2010-\u2015]/g, "-");
  let y = 20,
    pageNumber = 1;
  const footer = () => {
    pdf.setDrawColor(border);
    pdf.line(16, 280, 194, 280);
    pdf.setFontSize(7);
    pdf.setTextColor(muted);
    pdf.text(cleanPdfText(settings.reportFooter, "GridPulse decision support"), 16, 286, {
      maxWidth: 150,
    });
    pdf.text(`Page ${pageNumber}`, 194, 286, { align: "right" });
  };
  const nextPage = () => {
    footer();
    pdf.addPage();
    pageNumber += 1;
    y = 20;
    pdf.setFillColor(navy);
    pdf.rect(0, 0, 210, 10, "F");
  };
  const heading = (value: string) => {
    if (y > 254) nextPage();
    y += 3;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(ink);
    pdf.text(value, 16, y);
    pdf.setDrawColor(accent);
    pdf.setLineWidth(0.7);
    pdf.line(16, y + 3, 36, y + 3);
    y += 10;
  };
  const line = (label: string, value: unknown) => {
    const rendered = cleanPdfText(value);
    const wrapped = pdf.splitTextToSize(rendered, 118);
    const height = Math.max(7, wrapped.length * 4.2 + 2);
    if (y + height > 274) nextPage();
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(muted);
    pdf.text(label.toUpperCase(), 16, y);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(ink);
    pdf.text(wrapped, 72, y);
    y += height;
  };
  const card = (x: number, label: string, value: string, detail: string) => {
    pdf.setFillColor("#f4f8fa");
    pdf.setDrawColor(border);
    pdf.roundedRect(x, y, 56, 29, 2, 2, "FD");
    pdf.setTextColor(muted);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.text(label.toUpperCase(), x + 4, y + 6);
    pdf.setTextColor(ink);
    pdf.setFontSize(9);
    pdf.text(pdf.splitTextToSize(cleanPdfText(value), 48), x + 4, y + 13);
    pdf.setTextColor(muted);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text(pdf.splitTextToSize(cleanPdfText(detail), 48), x + 4, y + 23);
  };

  pdf.setFillColor(navy);
  pdf.rect(0, 0, 210, 58, "F");
  pdf.setFillColor(accent);
  pdf.rect(0, 0, 6, 58, "F");
  pdf.setTextColor("#8fe8f6");
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text(cleanPdfText(settings.organisationName, "GRIDPULSE").toUpperCase(), 16, y);
  y += 9;
  pdf.setTextColor("#ffffff");
  pdf.setFontSize(20);
  pdf.text("Site Decision Package", 16, y);
  y += 9;
  pdf.setFontSize(13);
  pdf.text(pdf.splitTextToSize(property.name, 170), 16, y);
  y = 70;
  line("Prepared for", settings.preparedFor || "Not specified");
  line("Classification", settings.confidentialityLabel);
  line("Declared load", capacityValue(data.summary.requiredMw));
  line("Location", data.summary.locationLabel);

  heading("Decision Summary");
  card(
    16,
    "Decision",
    decisionRecommendationLabel(property),
    property.decisionRationale ?? "No rationale recorded",
  );
  card(
    77,
    "Grid position",
    data.summary.preferredCandidate?.nodeName ??
      data.summary.recommendedCandidate?.nodeName ??
      "Not screened",
    data.summary.operator ?? "Operator unconfirmed",
  );
  const validated = (property.evidenceRegister ?? []).filter(
    (item) => item.validationStatus === "validated",
  ).length;
  card(
    138,
    "Validated evidence",
    String(validated),
    `${data.qualification.confirmedReadiness}% confirmed readiness`,
  );
  y += 37;
  line("Rationale", property.decisionRationale);
  line("Next action", data.summary.nextAction);
  line("Open checks", data.summary.blockers.join("; ") || "None recorded");

  heading("Essential Qualification");
  line("Confirmed readiness", `${data.qualification.confirmedReadiness}%`);
  line("Screening coverage", `${data.qualification.screeningCoverage}%`);
  const mvpKeys = new Set(["grid", "land", "planning", "environment", "access_logistics", "fibre"]);
  data.qualification.dimensions
    .filter((item) => mvpKeys.has(item.key))
    .forEach((item) =>
      line(
        qualificationLabels[item.key],
        `${item.status.toUpperCase()} - ${item.summary ?? "Not assessed"}${item.unsupported ? " (supporting evidence needed)" : ""}`,
      ),
    );

  heading("Grid Screening");
  line("Recommended", data.summary.recommendedCandidate?.nodeName);
  line("Shortlisted", data.summary.preferredCandidate?.nodeName);
  line("Likely operator", data.summary.operator);
  line(
    "Capacity",
    dossier.dossier.fail_closed
      ? "Not established - operator confirmation required"
      : "Validated evidence attached",
  );
  dossier.alternatives
    .slice(0, 3)
    .forEach((candidate, index) =>
      line(
        `Candidate ${index + 1}`,
        `${candidate.name}; ${candidate.distance_km == null ? "distance unknown" : `${candidate.distance_km.toFixed(1)} km`}; ${candidate.voltage_kv == null ? "voltage unknown" : `${candidate.voltage_kv} kV`}; ${candidate.operator ?? "operator unconfirmed"}`,
      ),
    );

  heading("Operator Engagement");
  const engagement = property.operatorEngagement!;
  line("Operator", engagement.operatorName);
  line("Responsibility", engagement.responsibilityStatus);
  line("Enquiry status", engagement.enquiryStatus);
  line("Reference", engagement.enquiryReference);
  line("Next action", engagement.nextAction);

  heading("Evidence Register");
  (property.evidenceRegister ?? []).forEach((item) =>
    line(
      item.title,
      `${item.claim} [${item.validationStatus}; ${item.sourceOrganisation ?? "source not recorded"}]`,
    ),
  );
  heading("Open Checks");
  (dossier.dossier.unresolved_evidence ?? []).forEach((item, index) =>
    line(`Check ${index + 1}`, item),
  );
  (dossier.dossier.operator_questions ?? []).forEach((item, index) =>
    line(`Operator question ${index + 1}`, item),
  );
  heading("Important Note");
  line("Scope", data.truthNotice);
  footer();
  pdf.save(`${property.name.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}-decision-package.pdf`);
}
