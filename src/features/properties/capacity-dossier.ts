import { jsPDF } from "jspdf";

export type CapacityDossierProjection = {
  property: {
    id: string;
    name: string;
    external_property_id: string | null;
    latitude: number;
    longitude: number;
    property_type: string;
    confidentiality_classification: string;
  };
  requirements: {
    requested_import_mw: number | null;
    requested_export_mw: number | null;
    required_it_load_mw: number | null;
    required_total_site_load_mw: number | null;
    target_energisation_year: number | null;
  };
  property_readiness: {
    land_control_status: string;
    planning_status: string;
    development_phase: string | null;
  };
  dossier: {
    status: string;
    evidence_class?: string;
    version?: number;
    model_version?: string | null;
    study_version?: string | null;
    capacity_basis_version?: string | null;
    n0_capacity_mw?: number | null;
    n1_firm_capacity_mw?: number | null;
    flexible_capacity_mw?: number | null;
    bess_assisted_capacity_mw?: number | null;
    restricted_hours?: number | null;
    binding_contingency?: string | null;
    binding_equipment?: string | null;
    thermal_constraint?: string | null;
    voltage_constraint?: string | null;
    search_bound_state?: string | null;
    source_register?: unknown[];
    assumptions?: unknown[];
    unresolved_evidence?: unknown[];
    operator_questions?: unknown[];
    claims_and_limitations?: unknown[];
    validation_status: string;
    valid_from?: string | null;
    valid_to?: string | null;
    fail_closed?: boolean;
  };
  alternatives: Array<{
    id: string;
    name: string;
    distance_km: number | null;
    voltage_kv: number | null;
    operator: string | null;
    status: string;
    capacity_state: string;
    context_score: number | null;
  }>;
};

export function parseCapacityDossier(value: unknown): CapacityDossierProjection {
  if (!value || typeof value !== "object") throw new Error("The dossier response is invalid.");
  const projection = value as CapacityDossierProjection;
  if (
    !projection.property?.id ||
    !projection.requirements ||
    !projection.dossier ||
    !Array.isArray(projection.alternatives)
  )
    throw new Error("The dossier response is incomplete.");
  return projection;
}

export function capacityValue(value: number | null | undefined) {
  return value == null
    ? "Unknown"
    : `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 }).format(value)} MW`;
}

function textValue(value: unknown) {
  if (value == null || value === "") return "Unknown";
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function downloadPropertyDossierPdf(data: CapacityDossierProjection) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = 18;
  const line = (label: string, value: unknown) => {
    if (y > 275) {
      pdf.addPage();
      y = 18;
    }
    pdf.setFont("helvetica", "bold");
    pdf.text(label, 16, y);
    pdf.setFont("helvetica", "normal");
    const wrapped = pdf.splitTextToSize(textValue(value), 120);
    pdf.text(wrapped, 72, y);
    y += Math.max(7, wrapped.length * 5);
  };
  pdf.setFontSize(17);
  pdf.text("Property Grid Qualification Dossier", 16, y);
  y += 10;
  pdf.setFontSize(10);
  line("Property", data.property.name);
  line("External ID", data.property.external_property_id);
  line(
    "Requirement",
    capacityValue(
      data.requirements.required_total_site_load_mw ?? data.requirements.requested_import_mw,
    ),
  );
  line("Dossier status", data.dossier.status);
  line("Evidence class", data.dossier.evidence_class);
  line("Validation", data.dossier.validation_status);
  line("N-0", capacityValue(data.dossier.n0_capacity_mw));
  line("N-1 firm", capacityValue(data.dossier.n1_firm_capacity_mw));
  line("Flexible", capacityValue(data.dossier.flexible_capacity_mw));
  line("BESS-assisted", capacityValue(data.dossier.bess_assisted_capacity_mw));
  line("Binding contingency", data.dossier.binding_contingency);
  line("Binding equipment", data.dossier.binding_equipment);
  line(
    "Model / study",
    `${textValue(data.dossier.model_version)} / ${textValue(data.dossier.study_version)}`,
  );
  line("Validity", `${textValue(data.dossier.valid_from)} to ${textValue(data.dossier.valid_to)}`);
  line("Evidence gaps", data.dossier.unresolved_evidence);
  line("Operator questions", data.dossier.operator_questions);
  line("Claims & limitations", data.dossier.claims_and_limitations);
  pdf.setFontSize(8);
  pdf.text(
    "A calculated result is not a connection offer, reservation, operator approval, queue statement, or timing guarantee.",
    16,
    290,
    { maxWidth: 178 },
  );
  pdf.save(
    `${data.property.name.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}-grid-qualification-dossier.pdf`,
  );
}

export function downloadPortfolioComparisonPdf(
  properties: Array<{
    id: string;
    name: string;
    project_type: string;
    requested_import_mw: number;
    requested_export_mw: number;
    likely_network_operator: string | null;
    operator_status: string;
    planning_status: string;
    land_status: string;
    assessment_status: string;
  }>,
) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  pdf.setFontSize(17);
  pdf.text("GridPulse Property Portfolio Comparison", 14, 16);
  pdf.setFontSize(8);
  pdf.text(
    "Requirements and evidence maturity only. Unknown capacity remains unknown; no value in this report is a connection offer or reservation.",
    14,
    23,
  );
  const headers = [
    "Property",
    "Type",
    "Import MW",
    "Export MW",
    "Operator",
    "Evidence",
    "Planning",
    "Land",
    "Assessment",
  ];
  const widths = [48, 26, 20, 20, 42, 28, 28, 26, 28];
  let y = 32;
  const row = (values: string[], bold = false) => {
    let x = 14;
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    values.forEach((value, index) => {
      pdf.text(pdf.splitTextToSize(value, widths[index] - 2)[0] ?? "", x, y);
      x += widths[index];
    });
    y += 7;
  };
  row(headers, true);
  properties.forEach((property) => {
    if (y > 195) {
      pdf.addPage();
      y = 18;
      row(headers, true);
    }
    row([
      property.name,
      property.project_type,
      String(property.requested_import_mw),
      String(property.requested_export_mw),
      property.likely_network_operator ?? "Unconfirmed",
      property.operator_status,
      property.planning_status,
      property.land_status,
      property.assessment_status,
    ]);
  });
  pdf.save("gridpulse-property-portfolio-comparison.pdf");
}
