import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { OutcomeProjectIndex } from "@/components/product/OutcomeProjectIndex";
import { listAnalyticsJobs } from "@/lib/analytics-api";
import { productCapabilities } from "@/config/product-mode";
import { CapabilityPrerequisite } from "@/components/product/CapabilityPrerequisite";

export const Route = createFileRoute("/operations")({
  component: OperationsIndex,
});

function OperationsIndex() {
  const jobs = useQuery({
    queryKey: ["shadow-verification-jobs"],
    queryFn: () => listAnalyticsJobs(100),
    enabled: productCapabilities.operate,
  });
  if (!productCapabilities.operate)
    return (
      <CapabilityPrerequisite
        eyebrow="Read-only operations"
        title="Shadow verification prerequisites"
        description="Compare planned and observed delivery only after a project has an approved plan and read-only telemetry integration."
        requirements={[
          "A saved project and approved plan",
          "A governed capacity envelope",
          "Read-only telemetry connection",
          "Shadow-operation access",
        ]}
      />
    );
  const shadow = (jobs.data ?? []).filter((job) => job.job_type === "shadow_verification");
  return (
    <OutcomeProjectIndex
      eyebrow="Read-only operations"
      title="Shadow verification"
      description="Compare plans with observed telemetry, surface quality and divergence blockers, and rehearse fail-safe decisions without issuing physical commands."
      destination="/operations/$id"
    >
      <section className="summary-grid" aria-label="Shadow verification status">
        <div>
          <span>Verification runs</span>
          <b>{shadow.length}</b>
          <small>Owner-isolated canonical jobs</small>
        </div>
        <div>
          <span>Needs attention</span>
          <b>
            {
              shadow.filter((job) => job.status === "failed" || job.result_payload?.ready === false)
                .length
            }
          </b>
          <small>Failed or blocked checks</small>
        </div>
        <div>
          <span>Control mode</span>
          <b>Read only</b>
          <small>No live dispatch transport</small>
        </div>
      </section>
    </OutcomeProjectIndex>
  );
}
