import { useRef } from "react";
import { ArrowUpRight, Code2, X } from "lucide-react";
import { CanonicalPlanningWorkbench } from "../../analytics/CanonicalPlanningWorkbench";

/** One persistent workbench, outside the narrow everyday-input workflow. */
export function AdvancedAnalysis() {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <section className="ops-advanced-entry" aria-labelledby="ops-advanced-label">
      <div className="ops-advanced-heading">
        <Code2 aria-hidden="true" />
        <h3 id="ops-advanced-label">Advanced analysis</h3>
        <span>Technical</span>
      </div>
      <p>
        Optional planning and replay with a reviewed model. Not needed to recalculate a scenario.
      </p>
      <button
        ref={trigger}
        type="button"
        className="secondary-button"
        aria-haspopup="dialog"
        onClick={() => {
          dialog.current?.showModal();
          title.current?.focus();
        }}
      >
        Open planning workbench <ArrowUpRight aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        className="ops-analysis-dialog"
        aria-labelledby="ops-analysis-title"
        aria-describedby="ops-analysis-description"
        onCancel={(event) => event.stopPropagation()}
        onClose={() => trigger.current?.focus()}
      >
        <header className="ops-analysis-header">
          <div>
            <p className="context-label">Advanced analysis · read-only</p>
            <h2 id="ops-analysis-title" ref={title} tabIndex={-1}>
              Planning workbench
            </h2>
            <p id="ops-analysis-description">
              For reviewed model contracts, not everyday scenario inputs.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close planning workbench"
            onClick={() => dialog.current?.close()}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="ops-analysis-content">
          <div className="ops-analysis-prerequisites">
            <strong>Before you run</strong>
            <p>
              Requires sign-in, a configured canonical engine and a reviewed JSON model. Scenario
              availability does not confirm engine readiness.
            </p>
            <small>
              No equipment commands. Your draft is kept in this workspace when you close the window.
            </small>
          </div>
          <CanonicalPlanningWorkbench />
        </div>
      </dialog>
    </section>
  );
}
