import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, FileCheck2, LoaderCircle } from "lucide-react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { operatorEnquiryPackageResultSchema } from "@/features/analytics/contracts";
import {
  listAnalyticsJobs,
  startOperatorEnquiryPackage,
  waitForAnalyticsJob,
  type AnalyticsJob,
} from "@/lib/analytics-api";
import { productCapabilities } from "@/config/product-mode";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Decision Packages | GridPulse" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReportsPage,
});

const packageInputs = new Set([
  "capacity_requirement",
  "facility_plan",
  "facility_uncertainty",
  "rolling_facility_plan",
  "market_qualification",
  "facility_historical_replay",
  "shadow_verification",
]);

function saveText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const jobs = useQuery({
    queryKey: ["canonical-analytics-jobs"],
    queryFn: () => listAnalyticsJobs(200),
    enabled: productCapabilities.workspace,
  });
  const candidates = useMemo(
    () =>
      (jobs.data ?? []).filter(
        (job) =>
          job.status === "succeeded" && packageInputs.has(job.job_type) && job.result_payload,
      ),
    [jobs.data],
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [packageJob, setPackageJob] = useState<AnalyticsJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const result = packageJob?.result_payload
    ? operatorEnquiryPackageResultSchema.safeParse(packageJob.result_payload)
    : null;

  async function buildPackage() {
    setBusy(true);
    setError(null);
    try {
      const chosen = candidates.filter((job) => selected.includes(job.id));
      const artifacts = Object.fromEntries(
        chosen.map((job) => [`${job.job_type}:${job.id}`, job.result_payload]),
      );
      const accepted = await startOperatorEnquiryPackage({
        schema_version: "gridpulse-operator-enquiry-package-request-v1",
        package_id: `operator-enquiry-${new Date().toISOString().slice(0, 10)}`,
        artifacts,
        blockers: ["operator_confirmation_required"],
        assumption_ids: [],
      });
      setPackageJob(await waitForAnalyticsJob(accepted.job_id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The package could not be generated");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell requireAuth>
      <main id="main-content" className="section-page">
        <PageHeading
          eyebrow="Decision packages"
          title="Operator enquiry package"
          description="Select canonical analytical results and generate one deterministic JSON and Markdown package. Results remain screening evidence until confirmed by the responsible operator."
        />
        {!productCapabilities.workspace ? (
          <section className="constraint-truth-banner">
            <FileCheck2 aria-hidden="true" />
            <p>
              <strong>Package preview.</strong> Save a project and complete its canonical
              assessments to unlock deterministic package generation. Public screening never creates
              an operator-confirmed capacity claim.
            </p>
          </section>
        ) : null}
        <section className="data-panel" aria-labelledby="package-inputs-title">
          <div className="section-toolbar">
            <div>
              <h2 id="package-inputs-title">Canonical artifacts</h2>
            </div>
            <span>{candidates.length} available</span>
          </div>
          {jobs.isLoading ? (
            <p>Loading analytical results…</p>
          ) : jobs.error ? (
            <p role="alert">Unable to load analytical results.</p>
          ) : (
            <div className="table-scroll">
              <table className="product-table">
                <thead>
                  <tr>
                    <th>Include</th>
                    <th>Analysis</th>
                    <th>Completed</th>
                    <th>Fingerprint</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        Run a capacity, facility, uncertainty, rolling, market, replay, or shadow
                        study first.
                      </td>
                    </tr>
                  ) : (
                    candidates.map((job) => (
                      <tr key={job.id}>
                        <td>
                          <input
                            aria-label={`Include ${job.job_type} ${job.id}`}
                            type="checkbox"
                            checked={selected.includes(job.id)}
                            onChange={(event) =>
                              setSelected((current) =>
                                event.target.checked
                                  ? [...current, job.id]
                                  : current.filter((id) => id !== job.id),
                              )
                            }
                          />
                        </td>
                        <td>
                          <b>{job.job_type.replaceAll("_", " ")}</b>
                        </td>
                        <td>
                          {job.completed_at ? new Date(job.completed_at).toLocaleString() : "—"}
                        </td>
                        <td>
                          <code>
                            {String(job.result_payload?.result_fingerprint ?? job.id).slice(0, 12)}
                          </code>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <button
            className="primary-button"
            type="button"
            disabled={busy || selected.length === 0}
            onClick={() => void buildPackage()}
          >
            {busy ? <LoaderCircle aria-hidden="true" /> : <FileCheck2 aria-hidden="true" />}{" "}
            Generate canonical package
          </button>
          {error ? <p role="alert">{error}</p> : null}
        </section>
        {result?.success ? (
          <section className="data-panel" aria-labelledby="package-result-title">
            <h2 id="package-result-title">Package ready</h2>
            <p>
              <code>{result.data.package.package_fingerprint}</code>
            </p>
            <p>Capacity claim: No · Automatic live dispatch: No</p>
            <div className="button-row">
              <button
                type="button"
                onClick={() =>
                  saveText(
                    "operator-enquiry.json",
                    result.data.package.json_text,
                    "application/json",
                  )
                }
              >
                <Download aria-hidden="true" /> JSON
              </button>
              <button
                type="button"
                onClick={() =>
                  saveText(
                    "operator-enquiry.md",
                    result.data.package.markdown_text,
                    "text/markdown",
                  )
                }
              >
                <Download aria-hidden="true" /> Markdown
              </button>
              <button
                type="button"
                onClick={() =>
                  saveText(
                    "manifest.json",
                    JSON.stringify(result.data.package.manifest, null, 2) + "\n",
                    "application/json",
                  )
                }
              >
                <Download aria-hidden="true" /> Manifest
              </button>
            </div>
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}
