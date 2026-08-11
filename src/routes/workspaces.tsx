import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BriefcaseBusiness, MapPin, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/product/AppShell";
import {
  listAnonymousProperties,
  subscribeAnonymousWorkspace,
} from "@/features/anonymous-workspace/repository";
import type { AnonymousProperty } from "@/features/anonymous-workspace/schema";
import { projectAnonymousProperty } from "@/features/anonymous-workspace/portfolio-projection";

export const Route = createFileRoute("/workspaces")({
  head: () => ({
    meta: [
      { title: "Site Workspaces | GridPulse" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SiteWorkspaces,
});

function SiteWorkspaces() {
  const [properties, setProperties] = useState<AnonymousProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = () =>
    void listAnonymousProperties().then((items) => {
      setProperties(items);
      setLoading(false);
    });
  useEffect(() => {
    refresh();
    return subscribeAnonymousWorkspace(refresh);
  }, []);
  const sites = useMemo(
    () => properties.map(projectAnonymousProperty).sort((a, b) => a.name.localeCompare(b.name)),
    [properties],
  );

  return (
    <AppShell>
      <main id="main-content" className="site-workspaces-page">
        <header className="workspace-directory-header">
          <div>
            <p className="context-label">Site-Level Due Diligence</p>
            <h1>Site Workspaces</h1>
            <p>
              Open the persistent working record for readiness, grid screening, evidence, operator
              engagement, and decisions.
            </p>
          </div>
          <Link to="/power-finder" className="primary-button">
            <Plus aria-hidden="true" /> Screen a New Site
          </Link>
        </header>
        {loading ? (
          <div className="decision-empty" role="status" aria-live="polite">
            Loading site workspaces…
          </div>
        ) : sites.length ? (
          <section className="workspace-directory" aria-label="Available site workspaces">
            {sites.map((site) => (
              <article key={site.id}>
                <header>
                  <div className="workspace-directory-icon" aria-hidden="true">
                    <BriefcaseBusiness />
                  </div>
                  <span className={`decision-chip is-${site.decisionStatus}`}>
                    {site.decisionStatus}
                  </span>
                </header>
                <div>
                  <h2>{site.name}</h2>
                  <p>
                    <MapPin aria-hidden="true" /> {site.locationLabel}
                  </p>
                </div>
                <dl>
                  <div>
                    <dt>Required Load</dt>
                    <dd>{site.requiredMw.toLocaleString("en-GB")} MW</dd>
                  </div>
                  <div>
                    <dt>Readiness</dt>
                    <dd>{site.qualificationReadiness}%</dd>
                  </div>
                  <div>
                    <dt>Open Gaps</dt>
                    <dd>{site.blockers.length}</dd>
                  </div>
                </dl>
                <p className="workspace-directory-next">
                  <b>Next:</b> {site.nextAction}
                </p>
                <Link
                  to="/portfolio/$id"
                  params={{ id: site.id }}
                  search={{ tab: "overview" }}
                  className="primary-button"
                >
                  Open Site Workspace <ArrowRight aria-hidden="true" />
                </Link>
              </article>
            ))}
          </section>
        ) : (
          <div className="decision-empty">
            <BriefcaseBusiness aria-hidden="true" />
            <h2>No Site Workspaces Yet</h2>
            <p>Import a portfolio or screen a site to create its working record.</p>
            <Link to="/portfolio" className="primary-button">
              Open Site Pipeline
            </Link>
          </div>
        )}
      </main>
    </AppShell>
  );
}
