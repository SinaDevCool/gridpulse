import { useBlocker } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useOperationsEvidenceDataStore } from "../hooks/evidence-store";

/** Tab changes preserve the provider; leaving the workspace discards its session-only data. */
export function OperationsExitGuard({ dirty }: { dirty: boolean }) {
  const evidence = useOperationsEvidenceDataStore();
  const imported = Object.keys(evidence.importReports[0]).length > 0;
  const blocker = useBlocker({
    shouldBlockFn: ({ next }) => (dirty || imported) && next.pathname !== "/operations",
    enableBeforeUnload: dirty || imported,
    withResolver: true,
  });
  const dialog = useRef<HTMLDialogElement>(null);
  const blocked = blocker.status === "blocked";
  useEffect(() => {
    const node = dialog.current;
    if (blocked && node && !node.open) node.showModal();
    if (!blocked && node?.open) node.close();
  }, [blocked]);
  return (
    <dialog
      className="ops-exit-dialog"
      ref={dialog}
      aria-labelledby="ops-exit-title"
      aria-describedby="ops-exit-description"
      onClose={() =>
        document.querySelector<HTMLButtonElement>(".solution-switcher > button")?.focus()
      }
      onCancel={(event) => {
        event.preventDefault();
        blocker.reset?.();
      }}
    >
      <h2 id="ops-exit-title">Leave Facility Operations?</h2>
      <p id="ops-exit-description">
        {dirty ? "Your unapplied scenario edits will be discarded. " : ""}
        {imported
          ? "Uploaded evidence is held only in this session and will be removed when you leave. "
          : ""}
        Nothing will be applied or sent to equipment.
      </p>
      <div>
        <button type="button" className="primary-button" onClick={() => blocker.reset?.()}>
          Stay in Operations
        </button>
        <button type="button" className="secondary-button" onClick={() => blocker.proceed?.()}>
          Leave without saving
        </button>
      </div>
    </dialog>
  );
}
