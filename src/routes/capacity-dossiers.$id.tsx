import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, ShieldAlert } from "lucide-react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { capacityValue, downloadPropertyDossierPdf, parseCapacityDossier } from "@/features/properties/capacity-dossier";

export const Route = createFileRoute("/capacity-dossiers/$id")({
  head: () => ({ meta: [{ title: "Property Capacity Dossier | GridPulse" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: CapacityDossierPage,
});

function CapacityDossierPage() {
  const { id } = Route.useParams();
  const query = useQuery({
    queryKey: ["property-capacity-dossier", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("property_capacity_dossier", { p_site_id: id });
      if (error) throw error;
      return parseCapacityDossier(data);
    },
  });
  const data = query.data;
  return <AppShell requireAuth><main id="main-content" className="section-page dossier-page">
    <Link to="/portfolio" className="back-link">← Property Portfolio</Link>
    {query.isLoading ? <p role="status" aria-live="polite">Loading governed dossier…</p> : query.error || !data ? <div role="alert" className="workspace-error"><h1>Dossier unavailable</h1><p>Check property access and try again.</p><button type="button" onClick={() => void query.refetch()}>Retry</button></div> : <>
      <PageHeading eyebrow="Governed Property-Node Evidence" title={data.property.name} description="Capacity evidence, assumptions, constraints and unresolved operator questions for this property. Missing values remain unknown." action={<button type="button" className="primary-button" onClick={() => downloadPropertyDossierPdf(data)}><Download aria-hidden="true" /> Download Dossier</button>} />
      <aside className={`dossier-boundary evidence-${data.dossier.evidence_class ?? "unverified"}`}><ShieldAlert aria-hidden="true" /><p><strong>{data.dossier.evidence_class?.replaceAll("_", " ") ?? "No governed calculation"}.</strong> A calculated result is not a connection offer, capacity reservation, operator approval, queue statement, or timing guarantee.</p></aside>
      {data.dossier.fail_closed ? <p className="form-message error-message" role="alert">This result is stale, failed, rejected, or expired. Capacity metrics are withheld until a valid study supersedes it.</p> : null}
      <section className="dossier-metrics" aria-label="Capacity evidence">
        <DossierMetric label="N-0 capacity" value={capacityValue(data.dossier.n0_capacity_mw)} />
        <DossierMetric label="N-1 firm capacity" value={capacityValue(data.dossier.n1_firm_capacity_mw)} />
        <DossierMetric label="Flexible capacity" value={capacityValue(data.dossier.flexible_capacity_mw)} />
        <DossierMetric label="BESS-assisted capacity" value={capacityValue(data.dossier.bess_assisted_capacity_mw)} />
      </section>
      <section className="workspace-card"><h2>Study & constraint basis</h2><dl className="dossier-definition-list"><div><dt>Status</dt><dd>{data.dossier.status}</dd></div><div><dt>Validation</dt><dd>{data.dossier.validation_status}</dd></div><div><dt>Model version</dt><dd>{data.dossier.model_version ?? "Unknown"}</dd></div><div><dt>Study version</dt><dd>{data.dossier.study_version ?? "Unknown"}</dd></div><div><dt>Binding contingency</dt><dd>{data.dossier.binding_contingency ?? "Unknown"}</dd></div><div><dt>Binding equipment</dt><dd>{data.dossier.binding_equipment ?? "Unknown"}</dd></div><div><dt>Search state</dt><dd>{data.dossier.search_bound_state ?? "Unknown"}</dd></div><div><dt>Validity</dt><dd>{data.dossier.valid_from ?? "Unknown"} – {data.dossier.valid_to ?? "Unknown"}</dd></div></dl></section>
      <section className="workspace-card"><h2>Alternative connection candidates</h2>{data.alternatives.length ? <table className="decision-table"><thead><tr><th>Candidate</th><th>Distance</th><th>Voltage</th><th>Operator context</th><th>Capacity state</th></tr></thead><tbody>{data.alternatives.map((candidate) => <tr key={candidate.id}><td>{candidate.name}</td><td>{candidate.distance_km == null ? "Unknown" : `${candidate.distance_km} km`}</td><td>{candidate.voltage_kv == null ? "Unknown" : `${candidate.voltage_kv} kV`}</td><td>{candidate.operator ?? "Unconfirmed"}</td><td>{candidate.capacity_state.replaceAll("_", " ")}</td></tr>)}</tbody></table> : <p>No alternative candidates are attached.</p>}</section>
      <section className="dossier-evidence-grid"><EvidenceList title="Unresolved evidence" items={data.dossier.unresolved_evidence} /><EvidenceList title="Operator questions" items={data.dossier.operator_questions} /><EvidenceList title="Assumptions" items={data.dossier.assumptions} /><EvidenceList title="Claims & limitations" items={data.dossier.claims_and_limitations} /></section>
    </>}
  </main></AppShell>;
}

function DossierMetric({ label, value }: { label: string; value: string }) { return <div className="portfolio-metric"><span>{label}</span><b>{value}</b><small>{value === "Unknown" ? "No valid governed metric" : "See study basis and validity"}</small></div>; }
function EvidenceList({ title, items = [] }: { title: string; items?: unknown[] }) { return <section className="workspace-card"><h2>{title}</h2>{items.length ? <ul>{items.map((item, index) => <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>)}</ul> : <p>None recorded.</p>}</section>; }
