import { createFileRoute,Link,useNavigate } from "@tanstack/react-router";

import { ArrowLeft,ShieldAlert } from "lucide-react";

import { useCallback,useEffect,useState } from "react";

import { z } from "zod";

import { toast } from "sonner";

import { AppShell } from "@/components/product/AppShell";

import {
getAnonymousProperty,
listAnonymousDocuments,
saveAnonymousProperty,
} from "@/features/anonymous-workspace/repository";

import {
migrateAnonymousProperty,
type AnonymousDocumentMetadata,
type AnonymousProperty,
} from "@/features/anonymous-workspace/schema";

import {
decisionRecommendationLabel,
deriveQualification,
} from "@/features/anonymous-workspace/data-centre-qualification";

import { preferredCandidate } from "@/features/anonymous-workspace/portfolio-projection";

import { tabDetails,tabs } from "../features/anonymous-workspace/site/presentation";

import {
StatusMetric,
WorkspaceStepActions,
} from "../features/anonymous-workspace/site/primitives";

import { Overview } from "../features/anonymous-workspace/site/Overview";

import { Qualification } from "../features/anonymous-workspace/site/Qualification";

import { GridWorkspace } from "../features/anonymous-workspace/site/GridWorkspace";

import { EvidenceOperator } from "../features/anonymous-workspace/site/EvidenceOperator";

import { Decision } from "../features/anonymous-workspace/site/Decision";

export const Route = createFileRoute("/portfolio/$id")({
  validateSearch: z.object({ tab: z.enum(tabs).optional() }),
  head: () => ({
    meta: [
      { title: "Site Workspace | GridPulse" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SiteWorkspace,
});

function SiteWorkspace() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [property, setProperty] = useState<AnonymousProperty | null>(null);
  const [documents, setDocuments] = useState<AnonymousDocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const tab = search.tab ?? "overview";
  const refresh = useCallback(async () => {
    const value = await getAnonymousProperty(id);
    setProperty(value ? migrateAnonymousProperty(value) : null);
    setDocuments(await listAnonymousDocuments(id));
    setLoading(false);
  }, [id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const save = async (next: AnonymousProperty, message = "Site saved") => {
    const updated = migrateAnonymousProperty({ ...next, updatedAt: new Date().toISOString() });
    await saveAnonymousProperty(updated);
    setProperty(updated);
    setDirty(false);
    toast.success(message);
  };
  if (loading)
    return (
      <AppShell>
        <main className="site-workspace-state">Loading site workspace…</main>
      </AppShell>
    );
  if (!property)
    return (
      <AppShell>
        <main className="site-workspace-state">
          <h1>Site not found</h1>
          <Link to="/portfolio" search={{ view: "pipeline" }}>
            Return to Sites
          </Link>
        </main>
      </AppShell>
    );
  const qualification = deriveQualification(property);
  const candidate = preferredCandidate(property);
  const recommendedCandidate = property.candidateSnapshots.find(
    (item) => item.id === property.recommendedCandidateId,
  );
  return (
    <AppShell>
      <main id="main-content" className="site-workspace-page">
        <header className="site-workspace-header">
          <div className="site-workspace-title">
            <Link to="/portfolio" search={{ view: "pipeline" }} className="back-link">
              <ArrowLeft aria-hidden="true" /> All sites
            </Link>
            <p className="context-label">Data Centre Opportunity</p>
            <h1>{property.name}</h1>
            <p>
              {property.siteLabel ?? property.municipality ?? "Location not labelled"} ·{" "}
              {property.requiredTotalSiteLoadMw ?? property.project.importMw} MW declared
            </p>
          </div>
          <div className={`decision-badge decision-${property.decisionStatus}`}>
            {decisionRecommendationLabel(property)}
          </div>
        </header>
        <section className="site-workspace-status" aria-label="Workspace status">
          <StatusMetric
            label="Confirmed"
            value={`${qualification.confirmedReadiness}%`}
            tone="confirmed"
          />
          <StatusMetric
            label="Screened"
            value={`${qualification.screeningCoverage}%`}
            tone="screened"
          />
          <StatusMetric
            label="Checks remaining"
            value={String(qualification.checksRemaining)}
            tone="attention"
          />
          <p className="truth-boundary">
            <ShieldAlert aria-hidden="true" /> Screening indicates context, not available capacity,
            cost or delivery date.
          </p>
        </section>
        <nav className="site-workspace-tabs" aria-label="Site workspace">
          {tabs.map((item) => {
            const detail = tabDetails[item];
            const Icon = detail.icon;
            return (
              <button
                key={item}
                className={tab === item ? "active" : ""}
                aria-label={detail.label}
                aria-current={tab === item ? "page" : undefined}
                onClick={() => {
                  setDirty(false);
                  void navigate({
                    to: "/portfolio/$id",
                    params: { id },
                    search: { tab: item },
                    replace: true,
                  });
                }}
              >
                <Icon aria-hidden="true" />
                <span>
                  <b>{detail.label}</b>
                  <small>{detail.hint}</small>
                </span>
              </button>
            );
          })}
        </nav>
        <section className="site-workspace-layout">
          <div className="site-workspace-canvas" onChangeCapture={() => setDirty(true)}>
            {tab === "overview" && (
              <Overview
                property={property}
                candidateName={candidate?.nodeName ?? recommendedCandidate?.nodeName ?? null}
                candidateShortlisted={Boolean(candidate)}
                onSave={save}
              />
            )}
            {tab === "qualification" && <Qualification property={property} onSave={save} />}
            {tab === "grid" && (
              <GridWorkspace
                property={property}
                candidateName={candidate?.nodeName ?? null}
                recommendedName={recommendedCandidate?.nodeName ?? null}
                onSave={save}
              />
            )}
            {tab === "evidence" && (
              <EvidenceOperator
                property={property}
                documents={documents}
                onSave={save}
                onDocuments={refresh}
                mode="evidence"
              />
            )}
            {tab === "operator" && (
              <EvidenceOperator
                property={property}
                documents={documents}
                onSave={save}
                onDocuments={refresh}
                mode="operator"
              />
            )}
            {tab === "decision" && (
              <Decision
                property={property}
                qualificationReady={qualification.decisionReady}
                onSave={save}
              />
            )}
            <WorkspaceStepActions propertyId={property.id} current={tab} />
          </div>
        </section>
      </main>
    </AppShell>
  );
}
