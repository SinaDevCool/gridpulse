import { Plus } from "lucide-react";

import { type AnonymousProperty } from "@/features/anonymous-workspace/schema";

export function Correspondence({
  property,
  onSave,
}: {
  property: AnonymousProperty;
  onSave: (property: AnonymousProperty, message?: string) => Promise<void>;
}) {
  const engagement = property.operatorEngagement!;
  return (
    <section className="correspondence-panel">
      <header>
        <div>
          <p className="context-label">Traceable contact history</p>
          <h3>Engagement timeline</h3>
        </div>
        <span>{engagement.correspondence.length} interactions</span>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const entry = {
            id: crypto.randomUUID(),
            occurredAt: String(form.get("occurredAt")),
            channel: String(form.get("channel")) as
              | "email"
              | "letter"
              | "call"
              | "meeting"
              | "portal",
            direction: String(form.get("direction")) as "outbound" | "inbound" | "internal",
            subject: String(form.get("subject")),
            summary: String(form.get("summary")),
          };
          void onSave(
            {
              ...property,
              operatorEngagement: {
                ...engagement,
                correspondence: [...engagement.correspondence, entry],
              },
            },
            "Interaction recorded",
          );
          event.currentTarget.reset();
        }}
      >
        <label>
          Date
          <input name="occurredAt" type="date" required />
        </label>
        <label>
          Channel
          <select name="channel">
            <option value="email">Email</option>
            <option value="letter">Letter</option>
            <option value="call">Call</option>
            <option value="meeting">Meeting</option>
            <option value="portal">Portal</option>
          </select>
        </label>
        <label>
          Direction
          <select name="direction">
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
            <option value="internal">Internal</option>
          </select>
        </label>
        <label className="correspondence-subject">
          Subject
          <input name="subject" required />
        </label>
        <label className="correspondence-outcome">
          Outcome or commitment
          <input name="summary" required />
        </label>
        <button type="submit">
          <Plus aria-hidden="true" /> <span>Record Interaction</span>
        </button>
      </form>
      <div>
        {[...engagement.correspondence]
          .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
          .map((item) => (
            <article key={item.id}>
              <time>{item.occurredAt}</time>
              <div>
                <b>{item.subject}</b>
                <span>
                  {item.channel} · {item.direction}
                </span>
                <p>{item.summary}</p>
              </div>
            </article>
          ))}
      </div>
    </section>
  );
}
