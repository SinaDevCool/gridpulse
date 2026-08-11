import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { exportAnonymousWorkspace, listAnonymousProperties, subscribeAnonymousWorkspace } from "@/features/anonymous-workspace/repository";
import type { AnonymousProperty } from "@/features/anonymous-workspace/schema";
import { downloadPortfolioComparisonPdf } from "@/features/properties/capacity-dossier";
import { downloadPropertyCsv, downloadPropertyGeoJson, downloadPropertyXlsx, type ExportableProperty } from "@/features/properties/property-export";

export const Route = createFileRoute("/reports")({ head: () => ({ meta: [{ title: "Anonymous Property Reports | GridPulse" }, { name: "robots", content: "noindex, nofollow" }] }), component: ReportsPage });

function exportable(property: AnonymousProperty): ExportableProperty {
  return { id: property.id, name: property.name, project_type: property.propertyType ?? property.project.type, latitude: property.project.latitude!, longitude: property.project.longitude!, requested_import_mw: property.requiredTotalSiteLoadMw ?? property.project.importMw, requested_export_mw: property.exportRequirementMw ?? property.project.exportMw, likely_network_operator: property.candidateSnapshots[0]?.operator ?? null, operator_status: property.candidateSnapshots.length ? "screening_context" : "not_assessed", planning_status: "not_assessed", land_status: property.landControlStatus, assessment_status: property.evidence?.validationStatus === "validated" ? "evidence_attached" : "screening", boundary: property.boundary };
}
function downloadBackup(value: unknown) { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "gridpulse-workspace-backup.json"; anchor.click(); URL.revokeObjectURL(url); }

function ReportsPage() {
  const [properties, setProperties] = useState<AnonymousProperty[]>([]);
  const refresh = () => void listAnonymousProperties().then(setProperties);
  useEffect(() => { refresh(); return subscribeAnonymousWorkspace(refresh); }, []);
  const rows = properties.map(exportable);
  const unresolved = properties.filter((property) => property.evidence?.validationStatus !== "validated").length;
  return <AppShell><main id="main-content" className="section-page management-report">
    <PageHeading eyebrow="Stored on this device" title="Property reports and exports" description="Generate portable decision records without an account. Unknown capacity remains Unknown in every format." action={properties.length ? <button type="button" className="primary-button" onClick={() => downloadPortfolioComparisonPdf(rows)}><Download aria-hidden="true" /> Portfolio PDF</button> : undefined} />
    <section className="management-kpi-grid"><article><span>Properties</span><strong>{properties.length}</strong></article><article><span>Declared requirement</span><strong>{properties.reduce((sum, item) => sum + (item.requiredTotalSiteLoadMw ?? item.project.importMw), 0).toLocaleString("en-GB")} MW</strong></article><article><span>With candidate snapshots</span><strong>{properties.filter((item) => item.candidateSnapshots.length).length}</strong></article><article><span>Capacity unresolved</span><strong>{unresolved}</strong></article></section>
    <section className="workspace-card report-export-actions" aria-labelledby="export-title"><div><h2 id="export-title">Data exchange and backup</h2><p>CSV, XLSX, and GeoJSON contain declared property information and screening context only. The workspace backup can restore this browser portfolio on another device.</p></div><div className="property-import-actions"><button type="button" className="secondary-button" disabled={!rows.length} onClick={() => downloadPropertyCsv(rows)}>Export CSV</button><button type="button" className="secondary-button" disabled={!rows.length} onClick={() => void downloadPropertyXlsx(rows)}>Export XLSX</button><button type="button" className="secondary-button" disabled={!rows.length} onClick={() => downloadPropertyGeoJson(rows)}>Export GeoJSON</button><button type="button" className="secondary-button" onClick={async () => downloadBackup(await exportAnonymousWorkspace())}>Workspace backup</button></div></section>
    <section><h2>Property dossiers</h2>{properties.length ? <div className="report-index-grid">{properties.map((property) => <article className="report-index-card" key={property.id}><p className="context-label">Local property</p><h2>{property.name}</h2><p>{property.requiredTotalSiteLoadMw ?? property.project.importMw} MW declared requirement</p><span className="status warning-text">{property.evidence?.validationStatus === "validated" ? "Accepted evidence attached" : "Capacity Unknown"}</span><Link to="/capacity-dossiers/$id" params={{ id: property.id }}>Open capacity dossier</Link></article>)}</div> : <div className="portfolio-state"><FileText aria-hidden="true" /><h2>No reports yet</h2><p>Save or import a property before generating reports.</p><Link to="/power-finder" className="primary-button">Screen a property</Link></div>}</section>
  </main></AppShell>;
}
