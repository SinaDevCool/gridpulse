import { ClipboardCheck,FileText } from "lucide-react";

import { label,type AssessmentActivity,type DecisionMemo } from "@/lib/assessment-model";

export function ActivityRoom({
  activity,
  memos,
}: {
  activity: AssessmentActivity[];
  memos: DecisionMemo[];
}) {
  return (
    <div className="activation-layout activity-layout">
      <section className="workspace-card activation-list">
        <div className="panel-heading">
          <div>
            <h2>Workspace activity</h2>
            <p>An append-only record of project, evidence, document and execution changes.</p>
          </div>
          <ClipboardCheck />
        </div>
        {activity.length === 0 ? (
          <div className="compact-empty">Activity will appear after the next workspace change.</div>
        ) : (
          activity.map((item) => (
            <article className="activation-row activity-row" key={item.id}>
              <div>
                <b>{item.summary}</b>
                <small>
                  {label(item.entity_type)} · {label(item.event_type)}
                </small>
              </div>
              <time>{new Date(item.created_at).toLocaleString("en-GB")}</time>
            </article>
          ))
        )}
      </section>
      <section className="workspace-card activation-list">
        <div className="panel-heading">
          <div>
            <h2>Saved decision memos</h2>
            <p>Immutable snapshots preserve what the team knew at each decision point.</p>
          </div>
          <FileText />
        </div>
        {memos.length === 0 ? (
          <div className="compact-empty">Save the first snapshot from the report tab.</div>
        ) : (
          memos.map((memo) => (
            <article className="activation-row" key={memo.id}>
              <div>
                <b>Decision memo v{memo.version}</b>
                <small>{memo.recommended_next_action}</small>
              </div>
              <span className="status">{memo.readiness_score}/100</span>
              <time>{new Date(memo.created_at).toLocaleDateString("en-GB")}</time>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
