import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download, FileUp, MapPin, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { PropertyImportPanel } from "@/features/properties/PropertyImportPanel";
import {
  clearAnonymousWorkspace,
  deleteAnonymousProperty,
  exportAnonymousWorkspace,
  listAnonymousProperties,
  restoreAnonymousWorkspace,
  subscribeAnonymousWorkspace,
} from "@/features/anonymous-workspace/repository";
import type { AnonymousProperty } from "@/features/anonymous-workspace/schema";

export const Route = createFileRoute("/portfolio")({
  validateSearch: z.object({ q: z.string().max(160).optional(), sort: z.enum(["updated", "name", "mw"]).optional() }),
  head: () => ({ meta: [{ title: "Anonymous Property Portfolio | GridPulse" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: Portfolio,
});

function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}

function Portfolio() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const restoreInput = useRef<HTMLInputElement>(null);
  const [properties, setProperties] = useState<AnonymousProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = async () => { try { setProperties(await listAnonymousProperties()); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Properties could not be loaded."); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); return subscribeAnonymousWorkspace(() => void refresh()); }, []);
  const visible = useMemo(() => {
    const needle = (search.q ?? "").trim().toLocaleLowerCase();
    return properties.filter((item) => !needle || [item.name, item.externalPropertyId, item.propertyType].some((value) => value?.toLocaleLowerCase().includes(needle))).sort((a, b) => search.sort === "name" ? a.name.localeCompare(b.name) : search.sort === "mw" ? (b.requiredTotalSiteLoadMw ?? -1) - (a.requiredTotalSiteLoadMw ?? -1) : Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }, [properties, search.q, search.sort]);
  return <AppShell><main id="main-content" className="section-page portfolio-page">
    <PageHeading eyebrow="Stored on this device" title="Property portfolio" description="Compare anonymous property screening records. Data stays in this browser unless you export a workspace backup." action={<Link to="/power-finder" className="primary-button"><Plus aria-hidden="true" /> New screening</Link>} />
    <section className="workspace-card anonymous-workspace-controls" aria-labelledby="workspace-data-title">
      <div><h2 id="workspace-data-title">Workspace data</h2><p>Back up before clearing browser storage or moving to another device.</p></div>
      <div className="property-import-actions">
        <button type="button" className="secondary-button" onClick={async () => downloadJson(await exportAnonymousWorkspace(), "gridpulse-workspace-backup.json")}><Download aria-hidden="true" /> Export backup</button>
        <button type="button" className="secondary-button" onClick={() => restoreInput.current?.click()}><FileUp aria-hidden="true" /> Restore backup</button>
        <input ref={restoreInput} className="sr-only" type="file" accept="application/json,.json" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const result = await restoreAnonymousWorkspace(JSON.parse(await file.text())); toast.success(`${result.imported} properties restored`); } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Restore failed"); } event.target.value = ""; }} />
        <button type="button" className="secondary-button" onClick={async () => { if (!window.confirm("Export a backup first if needed. Clear every locally stored property?")) return; await clearAnonymousWorkspace(); toast.success("Local workspace cleared"); }}><Trash2 aria-hidden="true" /> Clear workspace</button>
      </div>
    </section>
    <PropertyImportPanel onImported={() => void refresh()} />
    <section className="portfolio-work-queue" aria-labelledby="property-table-title">
      <div className="portfolio-controls"><div><h2 id="property-table-title">Property qualification</h2><p>{properties.length} locally stored {properties.length === 1 ? "property" : "properties"}</p></div><div className="portfolio-filter-row"><input aria-label="Search properties" placeholder="Search properties" value={search.q ?? ""} onChange={(event) => void navigate({ to: "/portfolio", search: { ...search, q: event.target.value || undefined }, replace: true })} /><select aria-label="Sort properties" value={search.sort ?? "updated"} onChange={(event) => void navigate({ to: "/portfolio", search: { ...search, sort: event.target.value as "updated" | "name" | "mw" }, replace: true })}><option value="updated">Recently updated</option><option value="name">Name</option><option value="mw">Required MW</option></select></div></div>
      {loading ? <p role="status">Loading local propertiesâ€¦</p> : error ? <p role="alert" className="error-message">{error}</p> : !visible.length ? <div className="portfolio-state"><MapPin aria-hidden="true" /><h2>No properties stored yet</h2><p>Screen a site in Power Finder or import a property file. No account is required.</p><Link to="/power-finder" className="primary-button">Screen a property</Link></div> : <div className="table-wrap portfolio-table-wrap"><table className="portfolio-table property-qualification-table"><caption className="sr-only">Anonymous property qualification comparison</caption><thead><tr><th>Property</th><th>Required MW</th><th>Location</th><th>Candidates</th><th>Capacity evidence</th><th>Land</th><th>Actions</th></tr></thead><tbody>{visible.map((property) => <PropertyRow key={property.id} property={property} onDelete={async () => { if (!window.confirm(`Delete ${property.name} from this browser?`)) return; await deleteAnonymousProperty(property.id); }} />)}</tbody></table></div>}
    </section>
  </main></AppShell>;
}

function PropertyRow({ property, onDelete }: { property: AnonymousProperty; onDelete: () => Promise<void> }) {
  const validityExpired = property.evidence?.validTo != null && Number.isFinite(Date.parse(property.evidence.validTo)) && Date.parse(property.evidence.validTo) < Date.now();
  const capacity = property.evidence?.validationStatus === "validated" && !validityExpired && !["stale", "failed"].includes(property.evidence.status) ? property.evidence.n1FirmCapacityMw : null;
  return <tr><td><b>{property.name}</b><small>{property.externalPropertyId ?? property.source.replaceAll("_", " ")}</small></td><td><b>{property.requiredTotalSiteLoadMw ?? "Unknown"}</b><small>Import requirement, not capacity</small></td><td><b>{property.project.latitude?.toFixed(4)}, {property.project.longitude?.toFixed(4)}</b><small>{property.boundary ? "Boundary stored" : "Point location"}</small></td><td><b>{property.candidateSnapshots.length}</b><small>{property.candidateSnapshots[0]?.nodeName ?? "Not screened"}</small></td><td><b>{capacity == null ? "Unknown" : `${capacity} MW`}</b><small>{property.evidence?.evidenceClass ?? "No accepted capacity evidence"}</small></td><td><b>{property.landControlStatus}</b><small>{property.propertyCondition ?? "Condition unknown"}</small></td><td><div className="property-row-actions"><Link to="/power-finder" search={{ propertyId: property.id, lat: property.project.latitude ?? undefined, lng: property.project.longitude ?? undefined, mw: property.project.importMw, projectType: property.project.type }}>Open in Finder</Link><Link to="/capacity-dossiers/$id" params={{ id: property.id }}>Dossier</Link><button type="button" onClick={() => void onDelete()} aria-label={`Delete ${property.name}`}><Trash2 size={15} /></button></div></td></tr>;
}
