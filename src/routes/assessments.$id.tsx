import {
archiveAssessment,
deleteAssessment,
loadAssessment,
} from "@/features/assessments/repository";
import { createFileRoute,Link,useNavigate } from "@tanstack/react-router";

import { useQuery,useQueryClient } from "@tanstack/react-query";

import { useState } from "react";

import {
AlertTriangle,
Archive,
ArrowLeft,
Check,
Gavel,
MessagesSquare,
PackageCheck,
Search,
Trash2,
} from "lucide-react";

import { toast } from "sonner";

import { z } from "zod";

import { AppShell } from "@/components/product/AppShell";

import { StrategyWorkbench } from "@/features/grid-connection/StrategyWorkbench";

import { NodeIntelligencePanel } from "@/features/grid-connection/NodeIntelligencePanel";

import {
assessmentViews,
stageForView,
workflowStages,
} from "@/features/grid-connection/workflow-navigation";

import { useAuth } from "@/context/useAuth";

import { label,readiness } from "@/lib/assessment-model";

import { type Tab } from "../features/assessments/presentation";

import { Overview } from "../features/assessments/Overview";

import { ExecutionRoom } from "../features/assessments/ExecutionRoom";

import { DocumentRoom } from "../features/assessments/DocumentRoom";

import { OperatorRoom } from "../features/assessments/OperatorRoom";

import { EvidenceRoom } from "../features/assessments/EvidenceRoom";

import { ProfileRoom } from "../features/assessments/ProfileRoom";

import { Scenarios } from "../features/assessments/Scenarios";

import { EnvelopeRoom } from "../features/assessments/EnvelopeRoom";

import { ActivityRoom } from "../features/assessments/ActivityRoom";

import { Report } from "../features/assessments/Report";

export const Route = createFileRoute("/assessments/$id")({
  validateSearch: z.object({
    view: z.enum(assessmentViews).optional().catch("overview"),
  }),
  head: () => ({
    meta: [
      { title: "Connection Project | GridPulse" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AssessmentPage,
});

function AssessmentPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { view: tab = "overview" } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const setTab = (view: Tab) => {
    void navigate({
      to: "/assessments/$id",
      params: { id },
      search: { view: view === "overview" ? undefined : view },
      replace: true,
    });
  };
  const query = useQuery({
    queryKey: ["assessment", id, user?.id],
    enabled: Boolean(user),
    queryFn: () => loadAssessment(id),
  });
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["assessment", id] });
    await queryClient.invalidateQueries({ queryKey: ["candidate-sites"] });
  }
  if (query.isLoading)
    return (
      <AppShell requireAuth>
        <main id="main-content" className="auth-gate">
          <div className="loading-spinner" />
          <p>Loading project…</p>
        </main>
      </AppShell>
    );
  if (query.error || !query.data)
    return (
      <AppShell requireAuth>
        <main id="main-content" className="auth-gate">
          <AlertTriangle />
          <h1>Project unavailable</h1>
          <p>
            {query.error instanceof Error
              ? query.error.message
              : "This record does not exist or is not accessible."}
          </p>
          <Link to="/portfolio" className="primary-button">
            Return to portfolio
          </Link>
        </main>
      </AppShell>
    );
  const {
    site,
    evidence,
    scenarios,
    profiles,
    documents,
    requirements,
    correspondence,
    envelopes,
    operatorProfiles,
    dataSources,
    dsos,
    milestones,
    collaborators,
    activity,
    memos,
    nodes,
    assets,
    snapshots,
    studies,
    assessmentRole,
  } = query.data;
  const ready = readiness(evidence);
  const activeStage = stageForView(tab);
  const stageStatus = {
    screen: site.operator_profile_key ? "Screened" : "Needs routing",
    prepare: `${documents.length + evidence.length} evidence items`,
    engage:
      site.operator_confirmation_status === "operator_confirmed"
        ? "Operator confirmed"
        : `${correspondence.length} exchanges`,
    decide: memos.length ? `Memo v${memos[0].version}` : "Decision open",
  };
  const stageIcons = {
    screen: Search,
    prepare: PackageCheck,
    engage: MessagesSquare,
    decide: Gavel,
  };
  async function archive() {
    setBusy(true);
    const { error } = await archiveAssessment(id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Project archived");
      await refresh();
    }
  }
  async function remove() {
    if (!window.confirm("Permanently delete this project and all evidence?")) return;
    setBusy(true);
    const { error } = await deleteAssessment(id);
    setBusy(false);
    if (error) toast.error(error.message);
    else await navigate({ to: "/portfolio" });
  }
  return (
    <AppShell requireAuth>
      <main id="main-content" className="section-page assessment-workspace">
        <Link to="/portfolio" className="back-link">
          <ArrowLeft />
          Portfolio
        </Link>
        <header className="assessment-title">
          <div>
            <p className="context-label">Connection project / {site.id.slice(0, 8)}</p>
            <h1>{site.name}</h1>
            <p>
              {label(site.project_type)} · {site.latitude}, {site.longitude}
            </p>
          </div>
          <div>
            <Link to="/pilot-case/$id" params={{ id }} className="secondary-button">
              Pilot measurement
            </Link>
            <Link to="/submission-package/$id" params={{ id }} className="secondary-button">
              Submission package
            </Link>
            <span className="status warning-text">{label(site.assessment_status)}</span>
            <button onClick={archive} disabled={busy}>
              <Archive />
              Archive
            </button>
            <button className="danger-button" onClick={remove} disabled={busy}>
              <Trash2 />
              Delete
            </button>
          </div>
        </header>
        <div className="readiness-strip">
          <div>
            <span>{ready.completed}/3</span>
            <div>
              <b>Report readiness</b>
              <small>
                {ready.ready ? "Required evidence satisfied" : "Evidence validation incomplete"}
              </small>
            </div>
          </div>
          {[
            [ready.official, "Official source"],
            [ready.customer, "Customer input"],
            [ready.operator, "Operator validation"],
          ].map(([done, text]) => (
            <span className={done ? "ready-item done" : "ready-item"} key={String(text)}>
              {done ? <Check /> : <AlertTriangle />}
              {text}
            </span>
          ))}
        </div>
        <nav className="workflow-nav" aria-label="Connection assessment workflow">
          {workflowStages.map((stage) => {
            const Icon = stageIcons[stage.key];
            const active = stage.key === activeStage.key;
            return (
              <button
                type="button"
                className={active ? "active" : ""}
                aria-current={active ? "step" : undefined}
                onClick={() => setTab(stage.defaultView)}
                key={stage.key}
              >
                <span>{stage.number}</span>
                <Icon aria-hidden="true" />
                <div>
                  <b>{stage.label}</b>
                  <small>{stageStatus[stage.key]}</small>
                </div>
              </button>
            );
          })}
        </nav>
        <section className="workflow-context" aria-labelledby="workflow-stage-title">
          <div>
            <span className="context-label">
              Stage {activeStage.number} · {activeStage.label}
            </span>
            <h2 id="workflow-stage-title">{activeStage.title}</h2>
            <p>{activeStage.description}</p>
          </div>
          <nav className="stage-tabs" aria-label={`${activeStage.label} views`}>
            {activeStage.views.map((view) => (
              <button
                type="button"
                className={tab === view.key ? "active" : ""}
                aria-current={tab === view.key ? "page" : undefined}
                onClick={() => setTab(view.key)}
                key={view.key}
              >
                {view.label}
              </button>
            ))}
          </nav>
        </section>
        {tab === "overview" ? (
          <Overview
            site={site}
            requirements={requirements}
            documents={documents}
            profiles={profiles}
            envelopes={envelopes}
            busy={busy}
            setBusy={setBusy}
            openTab={setTab}
            refresh={refresh}
          />
        ) : tab === "strategy" ? (
          <StrategyWorkbench
            site={site}
            evidence={evidence}
            scenarios={scenarios}
            profiles={profiles}
            refresh={refresh}
          />
        ) : tab === "nodes" ? (
          <NodeIntelligencePanel
            site={site}
            nodes={nodes}
            assets={assets}
            snapshots={snapshots}
            studies={studies}
            role={assessmentRole}
            refresh={refresh}
          />
        ) : tab === "execution" ? (
          <ExecutionRoom
            site={site}
            dsos={dsos}
            milestones={milestones}
            collaborators={collaborators}
            requirements={requirements}
            documents={documents}
            correspondence={correspondence}
            openReport={() => setTab("report")}
            refresh={refresh}
          />
        ) : tab === "documents" ? (
          <DocumentRoom site={site} documents={documents} refresh={refresh} />
        ) : tab === "operator" ? (
          <OperatorRoom
            site={site}
            documents={documents}
            requirements={requirements}
            correspondence={correspondence}
            operatorProfiles={operatorProfiles}
            dataSources={dataSources}
            refresh={refresh}
          />
        ) : tab === "evidence" ? (
          <EvidenceRoom site={site} evidence={evidence} refresh={refresh} />
        ) : tab === "profile" ? (
          <ProfileRoom site={site} profiles={profiles} refresh={refresh} />
        ) : tab === "scenarios" ? (
          <Scenarios site={site} scenarios={scenarios} profiles={profiles} refresh={refresh} />
        ) : tab === "envelopes" ? (
          <EnvelopeRoom site={site} documents={documents} envelopes={envelopes} refresh={refresh} />
        ) : tab === "activity" ? (
          <ActivityRoom activity={activity} memos={memos} />
        ) : (
          <Report
            site={site}
            evidence={evidence}
            scenarios={scenarios}
            profiles={profiles}
            requirements={requirements}
            documents={documents}
            milestones={milestones}
            envelopes={envelopes}
            memos={memos}
            refresh={refresh}
          />
        )}
      </main>
    </AppShell>
  );
}
