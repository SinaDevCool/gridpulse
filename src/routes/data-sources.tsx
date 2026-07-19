import { createFileRoute } from "@tanstack/react-router";
import { Building2, Database, ExternalLink, Map, RadioTower } from "lucide-react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { germanGridEvidenceGaps, germanGridSources } from "@/lib/german-grid-sources";
export const Route = createFileRoute("/data-sources")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: DataSourcesPage,
});
const sources = [
  {
    name: "Bundesnetzagentur",
    type: "Regulatory and network context",
    use: "Network operator and grid-area validation",
    status: "Public source",
    icon: Building2,
  },
  {
    name: "Marktstammdatenregister",
    type: "Asset registry",
    use: "Generation and storage asset context",
    status: "Connector retained",
    icon: Database,
  },
  {
    name: "SMARD",
    type: "Electricity market data",
    use: "System and market context; not connection capacity",
    status: "Connector retained",
    icon: RadioTower,
  },
  {
    name: "OpenStreetMap / OpenGridMap",
    type: "Geospatial context",
    use: "Infrastructure proximity screening requiring verification",
    status: "Public source",
    icon: Map,
  },
];
function DataSourcesPage() {
  return (
    <AppShell>
      <main id="main-content" className="section-page">
        <PageHeading
          eyebrow="Trust centre"
          title="Methodology and sources"
          description="Understand what each source can establish—and what still requires the network operator."
        />
        <div className="source-warning">
          <strong>Important:</strong> Public datasets can support site screening but generally
          cannot confirm live connection capacity, a connection date, or a final FCA schedule.
        </div>
        <div className="source-grid">
          {sources.map(({ icon: Icon, ...s }) => (
            <article className="source-card" key={s.name}>
              <div>
                <span className="source-icon">
                  <Icon />
                </span>
                <span className="status">{s.status}</span>
              </div>
              <h2>{s.name}</h2>
              <p>{s.type}</p>
              <dl>
                <dt>Used for</dt>
                <dd>{s.use}</dd>
                <dt>Evidence treatment</dt>
                <dd>Record source URL, retrieval date and limitations.</dd>
              </dl>
              <span className="source-guidance">
                Guidance recorded <ExternalLink size={13} aria-hidden="true" />
              </span>
            </article>
          ))}
        </div>
        <section className="official-source-register" aria-labelledby="official-source-heading">
          <div className="room-heading">
            <div>
              <p className="context-label">German official-source register</p>
              <h2 id="official-source-heading">Claims remain attached to their authority</h2>
              <p>Each source states both what it supports and what it cannot prove.</p>
            </div>
          </div>
          <div className="source-register-list">
            {germanGridSources.map((source) => (
              <article className="source-register-row" key={source.id}>
                <div>
                  <span className="status">{source.evidenceClass.replaceAll("_", " ")}</span>
                  <h3>{source.title}</h3>
                  <p>
                    {source.authority} · updated {source.publishedOrUpdated}
                  </p>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    Open official source <ExternalLink size={13} aria-hidden="true" />
                  </a>
                </div>
                <dl>
                  <dt>Supports</dt>
                  <dd>{source.establishes.join(" ")}</dd>
                  <dt>Does not prove</dt>
                  <dd>{source.doesNotEstablish.join(" ")}</dd>
                </dl>
              </article>
            ))}
          </div>
          <aside className="source-warning">
            <strong>Known evidence gaps:</strong> {germanGridEvidenceGaps.join(" ")}
          </aside>
        </section>
      </main>
    </AppShell>
  );
}
