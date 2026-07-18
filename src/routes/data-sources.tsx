import { createFileRoute } from "@tanstack/react-router";
import { Building2, Database, ExternalLink, Map, RadioTower } from "lucide-react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
export const Route = createFileRoute("/data-sources")({ component: DataSourcesPage });
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
      <main className="section-page">
        <PageHeading
          eyebrow="Source registry"
          title="Data sources"
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
              <button>
                View source guidance <ExternalLink size={13} />
              </button>
            </article>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
