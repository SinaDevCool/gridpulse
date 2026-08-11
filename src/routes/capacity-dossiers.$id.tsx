import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { getAnonymousProperty } from "@/features/anonymous-workspace/repository";
import { capacityValue, downloadPropertyDossierPdf, type CapacityDossierProjection } from "@/features/properties/capacity-dossier";
import { buildLocalCapacityDossier } from "@/features/properties/local-dossier";

export const Route = createFileRoute("/capacity-dossiers/$id")({ head: () => ({ meta: [{ title: "Anonymous Capacity Dossier | GridPulse" }, { name: "robots", content: "noindex, nofollow" }] }), component: CapacityDossierPage });

function CapacityDossierPage() {
  const { id } = Route.useParams();
  const [data, setData] = useState<CapacityDossierProjection | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void getAnonymousProperty(id).then((property) => setData(property ? buildLocalCapacityDossier(property) : null)).finally(() => setLoading(false)); }, [id]);
  return <AppShell><main id="main-content" className="section-page dossier-page"><Link to="/portfolio" className="back-link">â† Property Portfolio</Link>{loading ? <p role="status">Loading local dossierâ€¦</p> : !data ? <div className="portfolio-state"><h1>Property not found locally</h1><p>This anonymous property is not stored in this browser. Restore a workspace backup or return to Properties.</p></div> : <Dossier data={data} />}</main></AppShell>;
}

function Dossier({ data }: { data: CapacityDossierProjection }) {
  return <><PageHeading eyebrow="Stored on this device" title={data.property.name} description="Capacity evidence, assumptions, constraints, and unresolved operator questions. Missing values remain Unknown." action={<button type="button" className="primary-button" onClick={() => downloadPropertyDossierPdf(data)}><Download aria-hidden="true" /> Download dossier</button>} />
    <aside className="dossier-boundary"><ShieldAlert aria-hidden="true" /><p><strong>{data.dossier.evidence_class?.replaceAll("_", " ") ?? "No governed calculation"}.</strong> A calculated result is not a connection offer, reservation, operator approval, queue statement, or timing guarantee.</p></aside>
    {data.dossier.fail_closed ? <p className="form-message error-message" role="alert">No currently valid capacity evidence is attached. Capacity metrics are withheld and remain Unknown.</p> : null}
    <section className="dossier-metrics" aria-label="Capacity evidence"><Metric label="N-0 capacity" value={capacityValue(data.dossier.n0_capacity_mw)} /><Metric label="N-1 firm capacity" value={capacityValue(data.dossier.n1_firm_capacity_mw)} /><Metric label="Flexible capacity" value={capacityValue(data.dossier.flexible_capacity_mw)} /><Metric label="BESS-assisted capacity" value={capacityValue(data.dossier.bess_assisted_capacity_mw)} /></section>
    <section className="workspace-card"><h2>Project and evidence basis</h2><dl className="dossier-definition-list"><div><dt>Required load</dt><dd>{capacityValue(data.requirements.required_total_site_load_mw)}</dd></div><div><dt>Status</dt><dd>{data.dossier.status}</dd></div><div><dt>Validation</dt><dd>{data.dossier.validation_status}</dd></div><div><dt>Model version</dt><dd>{data.dossier.model_version ?? "Unknown"}</dd></div><div><dt>Study version</dt><dd>{data.dossier.study_version ?? "Unknown"}</dd></div><div><dt>Validity</dt><dd>{data.dossier.valid_from ?? "Unknown"} â€“ {data.dossier.valid_to ?? "Unknown"}</dd></div></dl></section>
    <section className="workspace-card"><h2>Alternative connection candidates</h2>{data.alternatives.length ? <div className="table-wrap"><table className="decision-table"><thead><tr><th>Candidate</th><th>Distance</th><th>Voltage</th><th>Operator context</th><th>Capacity</th></tr></thead><tbody>{data.alternatives.map((candidate) => <tr key={candidate.id}><td>{candidate.name}</td><td>{candidate.distance_km == null ? "Unknown" : `${candidate.distance_km} km`}</td><td>{candidate.voltage_kv == null ? "Unknown" : `${candidate.voltage_kv} kV`}</td><td>{candidate.operator ?? "Unconfirmed"}</td><td>{candidate.capacity_state.replaceAll("_", " ")}</td></tr>)}</tbody></table></div> : <p>No candidate snapshot is attached. Open this property in Finder to screen alternatives.</p>}</section>
    <section className="dossier-evidence-grid"><List title="Unresolved evidence" items={data.dossier.unresolved_evidence} /><List title="Operator questions" items={data.dossier.operator_questions} /><List title="Assumptions" items={data.dossier.assumptions} /><List title="Claims and limitations" items={data.dossier.claims_and_limitations} /></section></>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="portfolio-metric"><span>{label}</span><b>{value}</b><small>{value === "Unknown" ? "No accepted capacity evidence" : "Review evidence validity"}</small></div>; }
function List({ title, items = [] }: { title: string; items?: unknown[] }) { return <section className="workspace-card"><h2>{title}</h2>{items.length ? <ul>{items.map((item, index) => <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>)}</ul> : <p>None recorded.</p>}</section>; }
