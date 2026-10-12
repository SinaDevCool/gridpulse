import { useState,type FormEvent } from "react";

import {
AlertTriangle,
CalendarClock,
Download,
FileText,
LoaderCircle,
Plus,
Save,
Trash2,
Users,
Zap,
} from "lucide-react";

import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

import {
label,
type AssessmentCollaborator,
type AssessmentDocument,
type AssessmentMilestone,
type CandidateSite,
type DsoDirectoryEntry,
type OperatorCorrespondence,
type OperatorRequirement,
} from "@/lib/assessment-model";

import { csvCell,downloadText } from "./presentation";

export function ExecutionRoom({
  site,
  dsos,
  milestones,
  collaborators,
  requirements,
  documents,
  correspondence,
  openReport,
  refresh,
}: {
  site: CandidateSite;
  dsos: DsoDirectoryEntry[];
  milestones: AssessmentMilestone[];
  collaborators: AssessmentCollaborator[];
  requirements: OperatorRequirement[];
  documents: AssessmentDocument[];
  correspondence: OperatorCorrespondence[];
  openReport: () => void;
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function saveResponsibility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const values = new FormData(event.currentTarget);
    const level = String(values.get("operatorLevel"));
    const selectedDso = dsos.find((item) => item.key === String(values.get("dsoKey")));
    const operatorName =
      level === "distribution"
        ? selectedDso?.operator_name
        : (site.likely_network_operator ?? undefined);
    const source = String(values.get("responsibilitySource"));
    const { error } = await supabase
      .from("candidate_sites")
      .update({
        responsible_operator_name: operatorName ?? null,
        responsible_operator_level: level,
        responsibility_source: source,
        responsibility_confirmed_at: source === "operator" ? new Date().toISOString() : null,
      })
      .eq("id", site.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Connection responsibility saved");
    await refresh();
  }
  async function addMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const { error } = await supabase.from("assessment_milestones").insert({
      site_id: site.id,
      user_id: site.user_id,
      title: String(values.get("title")),
      due_at: new Date(String(values.get("dueAt"))).toISOString(),
      milestone_type: String(values.get("milestoneType")),
      reminder_days: Number(values.get("reminderDays")),
      notes: String(values.get("notes") || "") || null,
    });
    if (error) return toast.error(error.message);
    form.reset();
    toast.success("Milestone added");
    await refresh();
  }
  async function setMilestoneStatus(milestone: AssessmentMilestone, status: string) {
    const { error } = await supabase
      .from("assessment_milestones")
      .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
      .eq("id", milestone.id);
    if (error) return toast.error(error.message);
    await refresh();
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const invitedEmail = String(values.get("email")).trim().toLowerCase();
    const invitedRole = String(values.get("role"));
    const { error } = await supabase.from("assessment_collaborators").insert({
      site_id: site.id,
      owner_id: site.user_id,
      invited_email: invitedEmail,
      role: invitedRole,
    });
    if (error) return toast.error(error.message);
    await supabase.from("assessment_milestones").insert({
      site_id: site.id,
      user_id: site.user_id,
      title: `Review invitation · ${invitedEmail}`,
      milestone_type: "review_deadline",
      status: "open",
      due_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      reminder_days: 2,
      notes: `Invitee role: ${invitedRole}. Send the invitation through your approved company email channel.`,
    });
    form.reset();
    toast.success("Collaborator registered");
    await refresh();
  }
  async function removeCollaborator(id: string) {
    const { error } = await supabase.from("assessment_collaborators").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Collaborator access removed");
    await refresh();
  }
  function exportManifest() {
    const rows = [
      ["record_type", "item", "status", "evidence_or_date", "notes"],
      ...requirements.map((item) => [
        "requirement",
        item.label,
        item.status,
        documents.find((document) => document.id === item.document_id)?.file_name ?? "",
        item.notes ?? "",
      ]),
      ...documents.map((item) => [
        "document",
        item.file_name,
        item.review_status,
        item.source_classification,
        item.notes ?? "",
      ]),
      ...correspondence.map((item) => [
        "correspondence",
        item.subject,
        item.direction,
        item.occurred_at,
        item.summary,
      ]),
    ];
    downloadText(
      `${site.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-application-manifest.csv`,
      rows.map((row) => row.map(csvCell).join(",")).join("\n"),
      "text/csv;charset=utf-8",
    );
  }
  const now = Date.now();
  return (
    <div className="activation-stack execution-room">
      <div className="activation-layout">
        <form className="workspace-card activation-form" onSubmit={saveResponsibility}>
          <div className="panel-heading">
            <div>
              <h2>Connection responsibility</h2>
              <p>Use directory coverage for routing, then record the confirmation source.</p>
            </div>
            <Zap />
          </div>
          <label>
            Connection level
            <select
              name="operatorLevel"
              defaultValue={site.responsible_operator_level ?? "distribution"}
            >
              <option value="distribution">Distribution operator</option>
              <option value="transmission">Transmission operator</option>
            </select>
          </label>
          <label>
            Candidate DSO
            <select name="dsoKey" defaultValue="">
              <option value="">Select from major German DSOs</option>
              {dsos.map((dso) => (
                <option value={dso.key} key={dso.key}>
                  {dso.operator_name} — {dso.coverage_summary}
                </option>
              ))}
            </select>
          </label>
          <label>
            Responsibility evidence
            <select
              name="responsibilitySource"
              defaultValue={site.responsibility_source ?? "screening"}
            >
              <option value="screening">Screening only</option>
              <option value="customer">Customer confirmed</option>
              <option value="operator">Operator confirmed</option>
            </select>
          </label>
          <button className="primary-button" disabled={busy}>
            {busy ? <LoaderCircle className="spin" /> : <Save />} Save responsibility
          </button>
          <div className="source-warning">
            <AlertTriangle /> Directory coverage never proves capacity or parcel responsibility.
          </div>
        </form>
        <section className="workspace-card activation-list">
          <div className="panel-heading">
            <div>
              <h2>Application package</h2>
              <p>Export a traceable manifest for operator or adviser review.</p>
            </div>
            <Download />
          </div>
          <dl className="detail-list">
            <dt>Requirements</dt>
            <dd>{requirements.length}</dd>
            <dt>Documents</dt>
            <dd>{documents.length}</dd>
            <dt>Interactions</dt>
            <dd>{correspondence.length}</dd>
            <dt>Responsible operator</dt>
            <dd>{site.responsible_operator_name ?? "Unconfirmed"}</dd>
          </dl>
          <button className="primary-button" onClick={exportManifest}>
            <Download /> Download manifest CSV
          </button>
          <button onClick={openReport}>
            <FileText /> Open decision memo
          </button>
        </section>
      </div>
      <div className="activation-layout">
        <form className="workspace-card activation-form" onSubmit={addMilestone}>
          <div className="panel-heading">
            <div>
              <h2>Add deadline</h2>
              <p>Track submissions, meetings and energization gates.</p>
            </div>
            <CalendarClock />
          </div>
          <label>
            Milestone
            <input name="title" required />
          </label>
          <div className="form-grid two-columns">
            <label>
              Type
              <select name="milestoneType">
                <option value="operator_deadline">Operator deadline</option>
                <option value="submission">Submission</option>
                <option value="meeting">Meeting</option>
                <option value="internal">Internal</option>
                <option value="energization">Energization</option>
              </select>
            </label>
            <label>
              Due at
              <input name="dueAt" type="datetime-local" required />
            </label>
          </div>
          <label>
            Reminder lead time
            <select name="reminderDays" defaultValue="7">
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </label>
          <label>
            Notes
            <textarea name="notes" rows={3} />
          </label>
          <button className="primary-button">
            <Plus /> Add milestone
          </button>
        </form>
        <section className="workspace-card activation-list">
          <div className="panel-heading">
            <div>
              <h2>Deadline register</h2>
              <p>{milestones.filter((item) => item.status === "open").length} open milestones.</p>
            </div>
            <CalendarClock />
          </div>
          {milestones.length === 0 ? (
            <div className="compact-empty">No milestones recorded.</div>
          ) : (
            milestones.map((item) => {
              const days = Math.ceil((new Date(item.due_at).getTime() - now) / 86400000);
              return (
                <article
                  className={
                    days < 0 && item.status === "open" ? "timeline-row overdue" : "timeline-row"
                  }
                  key={item.id}
                >
                  <span>{item.status === "done" ? "Done" : days < 0 ? "Overdue" : `${days}d`}</span>
                  <div>
                    <b>{item.title}</b>
                    <small>
                      {new Date(item.due_at).toLocaleString()} · {label(item.milestone_type)}
                    </small>
                    <p>{item.notes}</p>
                  </div>
                  <button
                    onClick={() =>
                      void setMilestoneStatus(item, item.status === "done" ? "open" : "done")
                    }
                  >
                    {item.status === "done" ? "Reopen" : "Complete"}
                  </button>
                </article>
              );
            })
          )}
        </section>
      </div>
      <section className="workspace-card collaborator-card">
        <div className="panel-heading">
          <div>
            <h2>Project collaborators</h2>
            <p>Assign the narrowest role needed. Only the matching reviewer can sign approvals.</p>
          </div>
          <Users />
        </div>
        <form className="collaborator-form" onSubmit={invite}>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Role
            <select name="role">
              <option value="viewer">Read only</option>
              <option value="customer_contributor">Customer contributor</option>
              <option value="technical_reviewer">Technical reviewer</option>
              <option value="commercial_reviewer">Commercial reviewer</option>
              <option value="grid_expert">Grid expert</option>
              <option value="operator_reviewer">Network operator reviewer</option>
              <option value="workspace_admin">Workspace administrator</option>
            </select>
          </label>
          <button className="primary-button">
            <Plus /> Add collaborator
          </button>
        </form>
        <div className="collaborator-list">
          {collaborators.map((item) => (
            <div key={item.id}>
              <b>{item.invited_email}</b>
              <span>
                {label(item.role)} · {item.accepted_at ? "Accepted" : "Pending"}
              </span>
              {!item.accepted_at ? (
                <a
                  href={`mailto:${encodeURIComponent(item.invited_email)}?subject=${encodeURIComponent(`GridPulse review invitation: ${site.name}`)}&body=${encodeURIComponent(`You have been invited to review ${site.name} as ${label(item.role)}.\n\nOpen the dedicated review portal: https://gridpulseinsights.com/operator-review/${site.id}`)}`}
                >
                  Send invitation
                </a>
              ) : null}
              <button
                className="icon-button danger-button"
                onClick={() => void removeCollaborator(item.id)}
                aria-label={`Remove ${item.invited_email}`}
              >
                <Trash2 />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
