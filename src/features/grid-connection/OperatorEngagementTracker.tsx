import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  CircleDot,
  FileOutput,
  LoaderCircle,
  Send,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AssessmentDocument, CandidateSite } from "@/lib/assessment-model";

type Props = {
  site: CandidateSite;
  documents: AssessmentDocument[];
  refresh: () => Promise<void>;
};

type Engagement = {
  id: string;
  status: string;
  recipient_organization: string;
  recipient_contact: string | null;
  operator_reference: string | null;
  submission_package_id: string | null;
  requested_import_mw: number | null;
  indicated_import_mw: number | null;
  reinforcement_required: boolean | null;
  reinforcement_summary: string | null;
  estimated_connection_cost_eur: number | null;
  indicated_connection_date: string | null;
  response_due_at: string | null;
  offer_expires_at: string | null;
  reservation_expires_at: string | null;
  response_document_id: string | null;
  evidence_state: string;
  notes: string | null;
  updated_at: string;
};

const statuses = [
  "draft",
  "ready",
  "submitted",
  "acknowledged",
  "under_review",
  "information_requested",
  "response_received",
  "offer_received",
  "reserved",
  "declined",
  "withdrawn",
  "expired",
  "closed",
];

const display = (value: string) => value.replaceAll("_", " ");
const dateValue = (value: FormDataEntryValue | null) =>
  value ? new Date(String(value)).toISOString() : null;

export function OperatorEngagementTracker({ site, documents, refresh }: Props) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["operator-engagements", site.id],
    queryFn: async () => {
      const [engagements, packages, nodes, operators] = await Promise.all([
        supabase
          .from("operator_engagements")
          .select("*")
          .eq("site_id", site.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("submission_packages")
          .select("id,version,status,title")
          .eq("site_id", site.id)
          .order("version", { ascending: false }),
        supabase
          .from("network_nodes")
          .select("id,node_name,canonical_node_id")
          .eq("site_id", site.id),
        supabase.from("grid_operators").select("id,canonical_name").order("canonical_name"),
      ]);
      const error = engagements.error || packages.error || nodes.error || operators.error;
      if (error) throw error;
      return {
        engagements: engagements.data as Engagement[],
        packages: packages.data,
        nodes: nodes.data,
        operators: operators.data,
      };
    },
  });

  async function createEngagement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const node = query.data?.nodes.find((item) => item.id === values.get("nodeId"));
    setBusy(true);
    const { error } = await supabase.rpc("create_operator_engagement", {
      p_site_id: site.id,
      p_submission_package_id: String(values.get("packageId") || "") || null,
      p_recipient_organization: String(values.get("organization")),
      p_recipient_contact: String(values.get("contact") || ""),
      p_node_id: String(values.get("nodeId") || "") || null,
      p_canonical_node_id: node?.canonical_node_id ?? null,
      p_operator_id: String(values.get("operatorId") || "") || null,
      p_open_questions: String(values.get("questions") || "")
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    form.reset();
    toast.success("Operator engagement created");
    await Promise.all([
      query.refetch(),
      refresh(),
      client.invalidateQueries({ queryKey: ["operator-qualification", site.id] }),
    ]);
  }

  async function updateEngagement(engagement: Engagement, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const indicated = String(values.get("indicatedImportMw") || "");
    setBusy(true);
    const { error } = await supabase.rpc("update_operator_engagement_status", {
      p_engagement_id: engagement.id,
      p_status: String(values.get("status")),
      p_operator_reference: String(values.get("operatorReference") || ""),
      p_occurred_at: dateValue(values.get("occurredAt")),
      p_response_due_at: dateValue(values.get("responseDueAt")),
      p_offer_expires_at: dateValue(values.get("offerExpiresAt")),
      p_reservation_expires_at: dateValue(values.get("reservationExpiresAt")),
      p_response_document_id: String(values.get("responseDocumentId") || "") || null,
      p_indicated_import_mw: indicated ? Number(indicated) : null,
      p_reinforcement_required:
        values.get("reinforcementRequired") === ""
          ? null
          : values.get("reinforcementRequired") === "true",
      p_reinforcement_summary: String(values.get("reinforcementSummary") || ""),
      p_estimated_connection_cost_eur: values.get("estimatedCostEur")
        ? Number(values.get("estimatedCostEur"))
        : null,
      p_indicated_connection_date: String(values.get("connectionDate") || "") || null,
      p_notes: String(values.get("notes") || ""),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Engagement timeline updated");
    await Promise.all([
      query.refetch(),
      refresh(),
      client.invalidateQueries({ queryKey: ["operator-qualification", site.id] }),
    ]);
  }

  return (
    <section className="workspace-card engagement-tracker">
      <div className="panel-heading">
        <div>
          <p className="context-label">Connection enquiry control</p>
          <h2>Operator engagement and deadlines</h2>
          <p>Link the released package, record submission, and preserve every response boundary.</p>
        </div>
        <CalendarClock />
      </div>
      <form className="activation-form engagement-create" onSubmit={createEngagement}>
        <h3>Create controlled enquiry</h3>
        <div className="form-grid two-columns">
          <label>
            Recipient organization
            <input
              name="organization"
              required
              defaultValue={site.responsible_operator_name ?? site.likely_network_operator ?? ""}
            />
          </label>
          <label>
            Contact or team
            <input name="contact" placeholder="Grid connection team or email" />
          </label>
          <label>
            Released package
            <select name="packageId" defaultValue="">
              <option value="">No package linked yet</option>
              {query.data?.packages.map((item) => (
                <option value={item.id} key={item.id}>
                  v{item.version} · {display(item.status)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Candidate node
            <select name="nodeId" defaultValue="">
              <option value="">No project node selected</option>
              {query.data?.nodes.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.node_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Operator directory record
            <select name="operatorId" defaultValue="">
              <option value="">Unconfirmed operator</option>
              {query.data?.operators.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.canonical_name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Questions for the operator
          <textarea
            name="questions"
            rows={4}
            defaultValue={[
              "Please confirm the responsible operator and feasible connection voltage.",
              "Please advise whether the requested import requires reinforcement.",
              "Please provide indicative process, studies, cost basis, and earliest connection date.",
            ].join("\n")}
          />
        </label>
        <button className="primary-button" disabled={busy || query.isLoading}>
          {busy ? <LoaderCircle className="spin" /> : <FileOutput />} Create enquiry record
        </button>
      </form>
      <div className="engagement-list">
        {query.data?.engagements.map((engagement) => (
          <form
            className="engagement-card activation-form"
            key={engagement.id}
            onSubmit={(event) => void updateEngagement(engagement, event)}
          >
            <header>
              <span>
                <CircleDot />
                <b>{engagement.recipient_organization}</b>
              </span>
              <em>{display(engagement.status)}</em>
            </header>
            <p>
              Requested {engagement.requested_import_mw ?? "unknown"} MW · evidence{" "}
              {display(engagement.evidence_state)}
            </p>
            <div className="form-grid two-columns">
              <label>
                Status
                <select name="status" defaultValue={engagement.status}>
                  {statuses.map((status) => (
                    <option value={status} key={status}>
                      {display(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Event date
                <input name="occurredAt" type="datetime-local" />
              </label>
              <label>
                Operator reference
                <input
                  name="operatorReference"
                  defaultValue={engagement.operator_reference ?? ""}
                />
              </label>
              <label>
                Response deadline
                <input name="responseDueAt" type="datetime-local" />
              </label>
              <label>
                Offer expiry
                <input name="offerExpiresAt" type="datetime-local" />
              </label>
              <label>
                Reservation expiry
                <input name="reservationExpiresAt" type="datetime-local" />
              </label>
              <label>
                Response document
                <select
                  name="responseDocumentId"
                  defaultValue={engagement.response_document_id ?? ""}
                >
                  <option value="">No operator document linked</option>
                  {documents
                    .filter((item) => item.source_classification === "operator_source")
                    .map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.file_name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Indicated import MW
                <input
                  name="indicatedImportMw"
                  type="number"
                  min="0"
                  step="0.001"
                  defaultValue={engagement.indicated_import_mw ?? ""}
                />
              </label>
              <label>
                Reinforcement
                <select
                  name="reinforcementRequired"
                  defaultValue={
                    engagement.reinforcement_required === null
                      ? ""
                      : String(engagement.reinforcement_required)
                  }
                >
                  <option value="">Not stated</option>
                  <option value="true">Required</option>
                  <option value="false">Not stated as required</option>
                </select>
              </label>
              <label>
                Estimated cost EUR
                <input
                  name="estimatedCostEur"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={engagement.estimated_connection_cost_eur ?? ""}
                />
              </label>
              <label>
                Indicated connection date
                <input
                  name="connectionDate"
                  type="date"
                  defaultValue={engagement.indicated_connection_date ?? ""}
                />
              </label>
            </div>
            <label>
              Reinforcement summary
              <input
                name="reinforcementSummary"
                defaultValue={engagement.reinforcement_summary ?? ""}
              />
            </label>
            <label>
              Notes
              <textarea name="notes" defaultValue={engagement.notes ?? ""} />
            </label>
            <button disabled={busy}>
              {["submitted", "acknowledged", "under_review"].includes(engagement.status) ? (
                <Send />
              ) : (
                <CheckCircle2 />
              )}
              Save timeline event
            </button>
          </form>
        ))}
        {!query.isLoading && !query.data?.engagements.length && (
          <div className="compact-empty">
            No controlled enquiry exists. Create one after reviewing the release package.
          </div>
        )}
      </div>
    </section>
  );
}
