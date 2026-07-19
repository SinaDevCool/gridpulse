import type { OperatorPackageSnapshot } from "./deliverables";

type PdfOptions = {
  version: number;
  status: string;
  preferredStrategy?: string;
  rationale?: string;
};

const clean = (value: unknown) => String(value ?? "Not recorded").replace(/[^ -~]/g, "-");

export async function downloadOperatorPackagePdf(
  snapshot: OperatorPackageSnapshot,
  options: PdfOptions,
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const width = 210;
  const margin = 18;
  const usable = width - margin * 2;
  let page = 1;
  let y = 22;

  function footer() {
    pdf.setDrawColor(25, 58, 70);
    pdf.line(margin, 282, width - margin, 282);
    pdf.setFontSize(7);
    pdf.setTextColor(90, 110, 120);
    pdf.text(
      "GridPulse - customer-side planning package - operator confirmation required",
      margin,
      288,
    );
    pdf.text(String(page), width - margin, 288, { align: "right" });
  }

  function nextPage() {
    footer();
    pdf.addPage();
    page += 1;
    y = 20;
  }

  function ensure(space: number) {
    if (y + space > 275) nextPage();
  }

  function heading(title: string) {
    ensure(16);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(4, 184, 218);
    pdf.text(clean(title), margin, y);
    y += 9;
  }

  function line(label: string, value: unknown) {
    const wrapped = pdf.splitTextToSize(clean(value), usable - 50);
    ensure(Math.max(8, wrapped.length * 4.5 + 3));
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(45, 62, 70);
    pdf.text(clean(label), margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(10, 20, 26);
    pdf.text(wrapped, margin + 50, y);
    y += Math.max(7, wrapped.length * 4.5 + 2);
  }

  pdf.setFillColor(3, 14, 21);
  pdf.rect(0, 0, width, 297, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("GRIDPULSE", margin, 24);
  pdf.setFontSize(26);
  pdf.text("Operator engagement package", margin, 56);
  pdf.setFontSize(16);
  pdf.text(clean(snapshot.project.name), margin, 70);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(160, 190, 202);
  pdf.text(`Version ${options.version} - ${clean(options.status).toUpperCase()}`, margin, 84);
  pdf.text(`Generated ${new Date(snapshot.generatedAt).toLocaleDateString("en-GB")}`, margin, 92);
  pdf.setDrawColor(4, 184, 218);
  pdf.line(margin, 108, width - margin, 108);
  pdf.setFontSize(9);
  pdf.text(pdf.splitTextToSize(clean(snapshot.disclaimer), usable), margin, 122);
  nextPage();

  heading("1. Executive summary");
  line("Preferred strategy", options.preferredStrategy ?? "No preferred strategy approved");
  line("Decision rationale", options.rationale ?? "Not recorded");
  line("Requested import", `${snapshot.project.requestedImportMw} MW`);
  line("Target voltage", `${snapshot.project.targetVoltageKv ?? "Open"} kV`);
  line("Operator status", snapshot.project.operatorStatus);

  heading("2. Project and site information");
  Object.entries(snapshot.project).forEach(([key, value]) =>
    line(key, typeof value === "object" ? JSON.stringify(value) : value),
  );

  heading("3. Strategy comparison");
  snapshot.scenarios.forEach((scenario, index) => {
    ensure(28);
    line(`Scenario ${index + 1}`, scenario.name);
    line("Connection mode", scenario.connectionMode);
    line("Initial import", `${scenario.importLimitMw ?? "Open"} MW`);
    line("Conditional import", `${scenario.conditionalImportMw ?? 0} MW`);
    line("Eventual import", `${scenario.eventualImportMw ?? "Open"} MW`);
    line("Firmness", scenario.firmness);
    line(
      "Restriction schedule",
      scenario.restrictionSchedule ? JSON.stringify(scenario.restrictionSchedule) : "None declared",
    );
    line(
      "Dependencies",
      scenario.dependencies ? JSON.stringify(scenario.dependencies) : "Not recorded",
    );
    line("Status", scenario.status);
  });

  heading("4. Flexible connection analysis");
  line("Calculation version", snapshot.flexibility.calculationVersion);
  line("Gross shortfall", `${snapshot.flexibility.grossShortfallMw} MW`);
  line("Residual shortfall", `${snapshot.flexibility.residualShortfallMw} MW`);
  line("Annual constrained energy", `${snapshot.flexibility.annualConstrainedEnergyMwh} MWh`);
  line(
    "Modelled exposure",
    `EUR ${snapshot.flexibility.estimatedAnnualExposureEur.toLocaleString("en-GB")}`,
  );

  heading("5. Evidence register");
  snapshot.evidenceRegister.forEach((evidence, index) => {
    ensure(20);
    line(
      `${index + 1}. ${clean(evidence.title)}`,
      `${clean(evidence.classification)} | ${clean(evidence.validationStatus)} | ${clean(evidence.sourceName)}`,
    );
  });

  heading("6. Questions for the network operator");
  snapshot.questionsForOperator.forEach((question, index) => line(`${index + 1}`, question));

  heading("7. Limitations and declaration");
  line("Capacity", "GridPulse does not infer or confirm available network capacity.");
  line("Connection date", "No connection date is confirmed without written operator evidence.");
  line(
    "Engineering",
    "The responsible network operator remains controlling for network and security studies.",
  );
  line(
    "Commercial model",
    "Commercial results depend on customer-declared assumptions and must be validated.",
  );
  snapshot.evidenceGaps.forEach((gap, index) => line(`Evidence gap ${index + 1}`, gap));

  heading("8. Official methodology sources");
  snapshot.methodologySources.forEach((source, index) => {
    line(`${index + 1}. ${source.authority}`, source.title);
    line("Source URL", source.url);
    line("Does not establish", source.doesNotEstablish.join(" "));
  });
  footer();

  pdf.save(
    `${clean(snapshot.project.name).replace(/\s+/g, "-").toLowerCase()}-operator-package-v${options.version}.pdf`,
  );
}
