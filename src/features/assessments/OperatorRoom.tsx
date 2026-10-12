import { useState,type FormEvent } from "react";

import {
AlertTriangle,
ClipboardCheck,
ExternalLink,
FileText,
LoaderCircle,
Mail,
Plus,
Save,
Zap,
} from "lucide-react";

import { toast } from "sonner";

import { OperatorEngagementControl } from "@/features/grid-connection/OperatorEngagementControl";

import { OperatorEngagementTracker } from "@/features/grid-connection/OperatorEngagementTracker";

import { DecisionSnapshotPanel } from "@/features/grid-connection/DecisionSnapshotPanel";

import { ConnectionCandidatePanel } from "@/features/grid-connection/ConnectionCandidatePanel";

import { OperatorQualificationPanel } from "@/features/grid-connection/OperatorQualificationPanel";

import { supabase } from "@/integrations/supabase/client";

import {
label,
type AssessmentDocument,
type CandidateSite,
type GridDataSource,
type OperatorCorrespondence,
type OperatorProfile,
type OperatorRequirement,
} from "@/lib/assessment-model";

export function OperatorRoom({
  site,
  documents,
  requirements,
  correspondence,
  operatorProfiles,
  dataSources,
  refresh,
}: {
  site: CandidateSite;
  documents: AssessmentDocument[];
  requirements: OperatorRequirement[];
  correspondence: OperatorCorrespondence[];
  operatorProfiles: OperatorProfile[];
  dataSources: GridDataSource[];
  refresh: () => Promise<void>;
}) {
  const [profileBusy, setProfileBusy] = useState(false);
  async function applyProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileBusy(true);
    const values = new FormData(event.currentTarget);
    const profileKey = String(values.get("profileKey"));
    const { error } = await supabase.rpc("apply_operator_profile", {
      p_site_id: site.id,
      p_profile_key: profileKey,
    });
    setProfileBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Operator procedure applied");
    await refresh();
  }
  async function updateRequirement(requirement: OperatorRequirement, values: FormData) {
    const { error } = await supabase
      .from("operator_requirements")
      .update({
        status: String(values.get("status")),
        document_id: String(values.get("documentId") || "") || null,
        notes: String(values.get("notes") || "") || null,
      })
      .eq("id", requirement.id);
    if (error) return toast.error(error.message);
    toast.success("Requirement updated");
    await refresh();
  }
  async function addCorrespondence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const occurred = String(values.get("occurredAt"));
    const { error } = await supabase.from("operator_correspondence").insert({
      site_id: site.id,
      user_id: site.user_id,
      direction: String(values.get("direction")),
      contact_name: String(values.get("contactName") || "") || null,
      subject: String(values.get("subject")),
      occurred_at: new Date(occurred).toISOString(),
      summary: String(values.get("summary")),
      document_id: String(values.get("documentId") || "") || null,
    });
    if (error) return toast.error(error.message);
    form.reset();
    toast.success("Operator interaction logged");
    await refresh();
  }
  const readyCount = requirements.filter((item) =>
    ["ready", "submitted", "accepted", "not_applicable"].includes(item.status),
  ).length;
  return (
    <div className="activation-stack">
      <OperatorQualificationPanel
        site={site}
        requirements={requirements}
        documents={documents}
        correspondence={correspondence}
      />
      <section className="workspace-card operator-routing-card">
        <div className="panel-heading">
          <div>
            <h2>German operator routing</h2>
            <p>
              Apply the 2026 four-TSO maturity procedure, then confirm whether the case belongs at
              transmission or distribution level.
            </p>
          </div>
          <Zap />
        </div>
        <form className="operator-routing-form" onSubmit={applyProfile}>
          <label>
            Transmission-area profile
            <select name="profileKey" defaultValue={site.operator_profile_key ?? ""} required>
              <option value="" disabled>
                Select likely TSO area
              </option>
              {operatorProfiles.map((profile) => (
                <option key={profile.key} value={profile.key}>
                  {profile.operator_name} — {profile.region_label}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" disabled={profileBusy}>
            {profileBusy ? <LoaderCircle className="spin" /> : <ClipboardCheck />}
            Apply procedure
          </button>
        </form>
        <div className="source-warning">
          <AlertTriangle />
          <span>
            This routes the evidence workflow only. It does not confirm the responsible DSO,
            connection point, or available capacity.
          </span>
        </div>
      </section>
      <section className="workspace-card">
        <div className="panel-heading">
          <div>
            <h2>Operator application checklist</h2>
            <p>
              {readyCount}/{requirements.length} requirements ready · likely operator:{" "}
              {site.likely_network_operator ?? "not confirmed"}
            </p>
          </div>
          <ClipboardCheck />
        </div>
        <div className="requirement-grid">
          {requirements.map((requirement) => (
            <form
              className="requirement-card"
              key={requirement.id}
              onSubmit={(event) => {
                event.preventDefault();
                void updateRequirement(requirement, new FormData(event.currentTarget));
              }}
            >
              <div>
                <span>{label(requirement.category)}</span>
                <h3>{requirement.label}</h3>
                {requirement.source_url ? (
                  <a href={requirement.source_url} target="_blank" rel="noreferrer">
                    Operator source <ExternalLink />
                  </a>
                ) : null}
              </div>
              <select
                name="status"
                defaultValue={requirement.status}
                aria-label="Requirement status"
              >
                <option value="missing">Missing</option>
                <option value="in_progress">In progress</option>
                <option value="ready">Ready</option>
                <option value="submitted">Submitted</option>
                <option value="accepted">Accepted</option>
                <option value="not_applicable">Not applicable</option>
              </select>
              <select
                name="documentId"
                defaultValue={requirement.document_id ?? ""}
                aria-label="Linked document"
              >
                <option value="">No linked document</option>
                {documents.map((document) => (
                  <option value={document.id} key={document.id}>
                    {document.file_name}
                  </option>
                ))}
              </select>
              <input
                name="notes"
                defaultValue={requirement.notes ?? ""}
                placeholder="Requirement notes"
              />
              <button type="submit">
                <Save /> Save
              </button>
            </form>
          ))}
        </div>
      </section>
      <div className="activation-layout">
        <form className="workspace-card activation-form" onSubmit={addCorrespondence}>
          <div className="panel-heading">
            <div>
              <h2>Log operator interaction</h2>
              <p>Retain the decision and correspondence history.</p>
            </div>
            <Mail />
          </div>
          <div className="form-grid two-columns">
            <label>
              Type
              <select name="direction" defaultValue="outbound">
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
                <option value="meeting">Meeting</option>
                <option value="internal_note">Internal note</option>
              </select>
            </label>
            <label>
              Date and time
              <input name="occurredAt" type="datetime-local" required />
            </label>
          </div>
          <label>
            Contact
            <input name="contactName" placeholder="Operator contact or team" />
          </label>
          <label>
            Subject
            <input name="subject" required />
          </label>
          <label>
            Summary
            <textarea name="summary" rows={4} required />
          </label>
          <label>
            Attachment
            <select name="documentId" defaultValue="">
              <option value="">No attachment</option>
              {documents.map((document) => (
                <option value={document.id} key={document.id}>
                  {document.file_name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="submit">
            <Plus /> Add interaction
          </button>
        </form>
        <section className="workspace-card activation-list">
          <div className="panel-heading">
            <div>
              <h2>Correspondence timeline</h2>
              <p>{correspondence.length} recorded interactions.</p>
            </div>
            <Mail />
          </div>
          {correspondence.length === 0 ? (
            <div className="compact-empty">No operator interactions recorded.</div>
          ) : (
            correspondence.map((item) => (
              <article className="timeline-row" key={item.id}>
                <span>{label(item.direction)}</span>
                <div>
                  <b>{item.subject}</b>
                  <small>
                    {new Date(item.occurred_at).toLocaleString()} ·{" "}
                    {item.contact_name ?? "No contact recorded"}
                  </small>
                  <p>{item.summary}</p>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
      <OperatorEngagementControl
        site={site}
        documents={documents}
        correspondence={correspondence}
        refresh={refresh}
      />
      <OperatorEngagementTracker site={site} documents={documents} refresh={refresh} />
      <ConnectionCandidatePanel siteId={site.id} />
      <DecisionSnapshotPanel siteId={site.id} />
      <section className="workspace-card data-source-register">
        <div className="panel-heading">
          <div>
            <h2>Official-data register</h2>
            <p>Sources support context and evidence collection; limitations stay visible.</p>
          </div>
          <FileText />
        </div>
        <div className="data-source-grid">
          {dataSources.map((source) => (
            <article key={source.key}>
              <span>{source.authority}</span>
              <h3>{source.title}</h3>
              <p>{source.use_in_gridpulse}</p>
              <small>{source.limitation}</small>
              <a href={source.source_url} target="_blank" rel="noreferrer">
                Open source <ExternalLink />
              </a>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
