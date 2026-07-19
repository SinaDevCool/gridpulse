import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Mail, MapPin } from "lucide-react";
import { AppShell, PageHeading } from "@/components/product/AppShell";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pilot-requests")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: PilotRequests,
});

type RequestRow = {
  id: string;
  created_at: string;
  status: string;
  contact_name: string;
  work_email: string;
  company: string;
  project_name: string;
  project_type: string;
  project_stage: string;
  postcode: string;
  municipality: string;
  federal_state: string;
  requested_import_mw: number;
  minimum_viable_import_mw: number | null;
  requested_export_mw: number;
  candidate_site_count: number;
  operator_engagement_status: string;
  land_status: string;
  planning_status: string;
  load_profile_available: boolean;
  flexibility_status: string;
  commercial_deadline: string | null;
  battery_power_mw: number | null;
  battery_energy_mwh: number | null;
  target_connection_date: string | null;
  connection_challenge: string;
};
const statusLabels: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  declined: "Declined",
  converted: "Converted",
};

function assessmentProjectType(value: string): "bess" | "large_load" | "co_location" {
  if (value === "bess" || value === "co_location") return value;
  return "large_load";
}

function assessmentLandStatus(
  value: string,
): "unknown" | "identified" | "optioned" | "controlled" {
  if (value === "identified" || value === "optioned" || value === "controlled") return value;
  return "unknown";
}

function assessmentPlanningStatus(
  value: string,
): "unknown" | "not_started" | "pre_application" | "submitted" | "approved" {
  if (
    value === "not_started" ||
    value === "pre_application" ||
    value === "submitted" ||
    value === "approved"
  ) {
    return value;
  }
  return "unknown";
}

function PilotRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["pilot-requests", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pilot_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RequestRow[];
    },
  });
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("pilot_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pilot-requests", user?.id] }),
  });

  return (
    <AppShell requireAuth>
      <main id="main-content" className="section-page">
        <PageHeading
          eyebrow="Design-partner pipeline"
          title="Pilot requests"
          description="Review incoming German connection cases and qualify the next design-partner pilots."
        />
        {query.isLoading ? <div className="portfolio-state">Loading requests…</div> : null}
        {query.error ? (
          <div className="portfolio-state error-message">
            You do not have administrator access to pilot requests.
          </div>
        ) : null}
        {query.data?.length === 0 ? (
          <div className="portfolio-state">No pilot requests have been submitted yet.</div>
        ) : null}
        <div className="pilot-request-list">
          {query.data?.map((request) => (
            <article className="pilot-request-card" key={request.id}>
              <header>
                <div>
                  <span>{request.company}</span>
                  <h2>{request.project_name}</h2>
                </div>
                <select
                  value={request.status}
                  aria-label={`Status for ${request.project_name}`}
                  onChange={(event) =>
                    updateStatus.mutate({ id: request.id, status: event.target.value })
                  }
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </header>
              <div className="pilot-request-meta">
                <span>
                  <MapPin /> {request.postcode} {request.municipality}, {request.federal_state}
                </span>
                <span>
                  <CalendarDays /> {new Date(request.created_at).toLocaleDateString("en-GB")}
                </span>
                <a href={`mailto:${request.work_email}`}>
                  <Mail /> {request.contact_name} · {request.work_email}
                </a>
              </div>
              <dl>
                <div>
                  <dt>Type</dt>
                  <dd>{request.project_type.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>Stage</dt>
                  <dd>{request.project_stage.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>Import</dt>
                  <dd>
                    {request.requested_import_mw} MW requested /{" "}
                    {request.minimum_viable_import_mw ?? "—"} MW minimum
                  </dd>
                </div>
                <div>
                  <dt>Export</dt>
                  <dd>{request.requested_export_mw} MW</dd>
                </div>
                <div>
                  <dt>Battery</dt>
                  <dd>
                    {request.battery_power_mw ?? "—"} MW / {request.battery_energy_mwh ?? "—"} MWh
                  </dd>
                </div>
                <div>
                  <dt>Target date</dt>
                  <dd>{request.target_connection_date ?? "Not specified"}</dd>
                </div>
                <div>
                  <dt>Candidate sites</dt>
                  <dd>{request.candidate_site_count}</dd>
                </div>
                <div>
                  <dt>Operator engagement</dt>
                  <dd>{request.operator_engagement_status.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>Project maturity</dt>
                  <dd>
                    {request.land_status.replaceAll("_", " ")} land ·{" "}
                    {request.planning_status.replaceAll("_", " ")} planning
                  </dd>
                </div>
                <div>
                  <dt>Flexibility</dt>
                  <dd>{request.flexibility_status.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>Load profile</dt>
                  <dd>{request.load_profile_available ? "Available" : "Not available"}</dd>
                </div>
                <div>
                  <dt>Commercial deadline</dt>
                  <dd>{request.commercial_deadline ?? "Not specified"}</dd>
                </div>
              </dl>
              <p>{request.connection_challenge}</p>
              {request.status !== "converted" ? (
                <Link
                  to="/assessments/new"
                  search={{
                    pilotRequestId: request.id,
                    name: request.project_name,
                    projectType: assessmentProjectType(request.project_type),
                    postcode: request.postcode,
                    municipality: request.municipality,
                    federalState: request.federal_state,
                    importMw: request.requested_import_mw,
                    minimumViableImportMw: request.minimum_viable_import_mw ?? undefined,
                    exportMw: request.requested_export_mw,
                    batteryPowerMw: request.battery_power_mw ?? undefined,
                    batteryEnergyMwh: request.battery_energy_mwh ?? undefined,
                    targetDate: request.target_connection_date ?? undefined,
                    landStatus: assessmentLandStatus(request.land_status),
                    planningStatus: assessmentPlanningStatus(request.planning_status),
                    challenge: request.connection_challenge,
                  }}
                  className="primary-button"
                >
                  Create pilot workspace <ArrowRight />
                </Link>
              ) : (
                <span className="status">Workspace created</span>
              )}
            </article>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
