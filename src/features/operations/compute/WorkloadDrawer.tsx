import { useEffect,useRef } from "react";

import { AlertTriangle,CheckCircle2,X } from "lucide-react";

import { OperationsEvidenceBadge } from "../components";

import { type WorkloadDecision } from "../workload-intelligence";

import { formatMinutes,formatOperationsTime } from "../presentation";

import { WorkloadSchedule } from "../WorkloadSchedule";

import { Row } from "./primitives";

import { integer,number } from "./presentation";

export function WorkloadDrawer({
  workload,
  onClose,
}: {
  workload: WorkloadDecision;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", dismiss);
    return () => {
      document.removeEventListener("keydown", dismiss);
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);
  return (
    <aside className="compute-drawer" aria-label={`Workload details: ${workload.name}`}>
      <header>
        <div>
          <p className="context-label">Selected Workload</p>
          <h3>{workload.name}</h3>
          <span>{workload.workloadId}</span>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close workload details">
          <X aria-hidden="true" />
        </button>
      </header>
      <OperationsEvidenceBadge kind={workload.source === "scenario" ? "simulated" : "measured"} />
      <WorkloadSchedule workload={workload} />
      <dl>
        <Row label="Class" value={workload.workloadClass} />
        <Row label="Status" value={workload.status} />
        <Row label="Requested GPUs" value={integer.format(workload.requestedGpuCount)} />
        <Row label="Power contribution" value={`${number.format(workload.estimatedPowerMw)} MW`} />
        <Row label="Checkpointable" value={workload.checkpointable ? "Yes" : "No"} />
        <Row label="Preemptible" value={workload.preemptible ? "Yes" : "No"} />
        <Row label="Deadline slack" value={formatMinutes(workload.deadlineSlackMinutes)} />
        <Row
          label="Proposed start"
          value={formatOperationsTime(
            workload.recommended ? workload.proposedStart : workload.earliestStart,
            true,
          )}
        />
      </dl>
      <div
        className={workload.eligible ? "compute-decision-note eligible" : "compute-decision-note"}
      >
        {workload.eligible ? (
          <CheckCircle2 aria-hidden="true" />
        ) : (
          <AlertTriangle aria-hidden="true" />
        )}
        <p>
          <strong>{workload.eligible ? "Eligible for scenario" : "Protected from movement"}</strong>
          <span>{workload.reason}</span>
        </p>
      </div>
    </aside>
  );
}
