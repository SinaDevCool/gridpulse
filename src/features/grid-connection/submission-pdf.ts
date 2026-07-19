type Manifest = ReturnType<typeof import("./submission-package").buildSubmissionManifest>;

const ascii = (value: unknown) =>
  String(value ?? "Not recorded")
    .normalize("NFKD")
    .replace(/[^ -~]/g, "-");

export async function downloadSubmissionPdf(
  manifest: Manifest,
  version: number,
  recipient: string,
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const margin = 17;
  const width = 210;
  const usable = 176;
  let y = 20;
  let page = 1;
  const footer = () => {
    pdf.setDrawColor(35, 61, 74);
    pdf.line(margin, 282, width - margin, 282);
    pdf.setFontSize(7);
    pdf.setTextColor(90, 110, 120);
    pdf.text("GridPulse - customer-side operator engagement package", margin, 288);
    pdf.text(String(page), width - margin, 288, { align: "right" });
  };
  const next = () => {
    footer();
    pdf.addPage();
    page += 1;
    y = 20;
  };
  const ensure = (space: number) => {
    if (y + space > 275) next();
  };
  const heading = (text: string) => {
    ensure(14);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(0, 155, 200);
    pdf.text(ascii(text), margin, y);
    y += 9;
  };
  const row = (label: string, value: unknown) => {
    const lines = pdf.splitTextToSize(ascii(value), 118) as string[];
    ensure(Math.max(7, lines.length * 4 + 3));
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(45, 62, 70);
    pdf.text(ascii(label), margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(12, 24, 31);
    pdf.text(lines, margin + 55, y);
    y += Math.max(7, lines.length * 4 + 2);
  };

  pdf.setFillColor(3, 14, 21);
  pdf.rect(0, 0, width, 297, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("GRIDPULSE", margin, 25);
  pdf.setFontSize(24);
  pdf.text("Netzbetreiber-Unterlagen", margin, 56);
  pdf.setFontSize(17);
  pdf.text("Operator engagement package", margin, 68);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(155, 190, 204);
  pdf.text(`Version ${version} | Recipient: ${ascii(recipient || "Open")}`, margin, 84);
  pdf.text(pdf.splitTextToSize(ascii(manifest.truthNotice), usable), margin, 106);
  next();

  heading("1. Projekt / Project");
  Object.entries(manifest.project).forEach(([key, value]) =>
    row(key, typeof value === "object" ? JSON.stringify(value) : value),
  );
  heading("2. Release controls / Freigabekontrollen");
  manifest.releaseGates.forEach((gate, index) =>
    row(`${index + 1}. ${gate.complete ? "PASS" : "OPEN"}`, gate.label),
  );
  heading("3. Network nodes and capacity versions");
  manifest.sections.networkNodes.forEach((item, index) =>
    row(`Node ${index + 1}`, JSON.stringify(item)),
  );
  manifest.sections.capacityVersions.forEach((item, index) =>
    row(`Capacity v${index + 1}`, JSON.stringify(item)),
  );
  heading("4. Connection scenarios");
  manifest.sections.connectionScenarios.forEach((item, index) =>
    row(`Scenario ${index + 1}`, JSON.stringify(item)),
  );
  heading("5. Evidence register and documents");
  manifest.sections.evidenceRegister.forEach((item, index) =>
    row(`Evidence ${index + 1}`, JSON.stringify(item)),
  );
  manifest.sections.documentInventory.forEach((item, index) =>
    row(`Document ${index + 1}`, JSON.stringify(item)),
  );
  heading("6. Fragen an den Netzbetreiber / Operator questions");
  manifest.sections.questionsForOperator.forEach((question, index) =>
    row(String(index + 1), question),
  );
  heading("7. Operator decisions and open milestones");
  manifest.sections.operatorDecisions.forEach((item, index) =>
    row(`Decision ${index + 1}`, JSON.stringify(item)),
  );
  manifest.sections.milestones.forEach((item, index) =>
    row(`Milestone ${index + 1}`, JSON.stringify(item)),
  );
  heading("8. Declaration / Erklaerung");
  row("Capacity", "Only entries labelled operator_confirmed are treated as operator evidence.");
  row(
    "Engineering",
    "The responsible network operator controls connection studies, security assessment and any offer.",
  );
  row(
    "Release",
    "Approved for operator means customer-side release approval, not operator acceptance.",
  );
  footer();
  pdf.save(
    `${ascii(manifest.project.name).replace(/\s+/g, "-").toLowerCase()}-operator-submission-v${version}.pdf`,
  );
}
