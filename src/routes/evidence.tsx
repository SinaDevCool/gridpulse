import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ExternalLink, FileSearch } from "lucide-react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { label, type Evidence } from "@/lib/assessment-model";
export const Route = createFileRoute("/evidence")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: EvidencePage,
});
type EvidenceRow = Evidence & { candidate_sites: { name: string } | null };
function EvidencePage() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["all-evidence", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_evidence")
        .select("*,candidate_sites(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EvidenceRow[];
    },
  });
  const rows = query.data ?? [];
  const collected = rows.filter((r) =>
    ["collected", "validated"].includes(r.validation_status),
  ).length;
  const missing = rows.filter((r) => r.validation_status === "missing").length;
  return (
    <AppShell requireAuth>
      <main className="section-page">
        <PageHeading
          eyebrow="Evidence room"
          title="Evidence ledger"
          description="One traceable record for public sources, customer inputs, assumptions, calculations, and operator validation."
        />
        <div className="summary-grid">
          <div>
            <span>Recorded</span>
            <b>{rows.length}</b>
            <small>Across your private portfolio</small>
          </div>
          <div>
            <span>Collected or validated</span>
            <b>{collected}</b>
            <small>Source or input recorded</small>
          </div>
          <div>
            <span>Missing</span>
            <b>{missing}</b>
            <small>Evidence still required</small>
          </div>
        </div>
        <div className="data-panel">
          <div className="section-toolbar">
            <div>
              <button className="filter-active">All evidence</button>
            </div>
            <span>{rows.length} items</span>
          </div>
          <div className="table-scroll">
            <table className="product-table">
              <thead>
                <tr>
                  <th>Evidence item</th>
                  <th>Assessment</th>
                  <th>Source</th>
                  <th>Classification</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {query.isLoading ? (
                  <tr>
                    <td colSpan={5}>Loading evidence…</td>
                  </tr>
                ) : query.error ? (
                  <tr>
                    <td colSpan={5}>
                      {query.error instanceof Error
                        ? query.error.message
                        : "Unable to load evidence"}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No evidence yet. Open an assessment to add the first item.</td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <b>{row.title}</b>
                      </td>
                      <td>{row.candidate_sites?.name ?? "Assessment"}</td>
                      <td>
                        {row.source_url ? (
                          <a href={row.source_url} target="_blank" rel="noreferrer">
                            {row.source_name || "Open source"} <ExternalLink />
                          </a>
                        ) : (
                          row.source_name || "—"
                        )}
                      </td>
                      <td>
                        <span className="evidence evidence-input">{label(row.classification)}</span>
                      </td>
                      <td>
                        <span
                          className={
                            row.validation_status === "missing"
                              ? "row-state missing"
                              : row.validation_status === "validated"
                                ? "row-state collected"
                                : "row-state review"
                          }
                        >
                          {row.validation_status === "missing" ? (
                            <AlertTriangle />
                          ) : row.validation_status === "validated" ? (
                            <CheckCircle2 />
                          ) : (
                            <FileSearch />
                          )}
                          {label(row.validation_status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="index-hint">
          Add or edit evidence inside an individual{" "}
          <Link to="/portfolio">assessment workspace</Link>.
        </p>
      </main>
    </AppShell>
  );
}
