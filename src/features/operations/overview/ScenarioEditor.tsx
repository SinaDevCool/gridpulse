import { useEffect,useState,type FormEvent } from "react";

import { Settings2 } from "lucide-react";

import { OperationsEvidenceBadge } from "../components";

import { operationsScenarioSchema,type OperationsScenario } from "../scenario-engine";

export function ScenarioEditor({
  scenario,
  onApply,
}: {
  scenario: OperationsScenario;
  onApply: (scenario: OperationsScenario) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(scenario);
  const [error, setError] = useState("");
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);
  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = operationsScenarioSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the scenario assumptions.");
      return;
    }
    onApply(parsed.data);
    setError("");
    setOpen(false);
  }
  return (
    <div className="operations-v2-editor">
      <button
        type="button"
        className="operations-v2-configure"
        disabled={!interactive}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <Settings2 aria-hidden="true" />
        Configure Scenario
      </button>
      {open ? (
        <form onSubmit={submit} className="operations-v2-editor-panel">
          <header>
            <div>
              <p className="context-label">Scenario Assumptions</p>
              <h2>Configure Scenario</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close scenario configuration"
            >
              ×
            </button>
          </header>
          <div className="operations-v2-editor-grid">
            <NumberField
              label="Facility Limit"
              unit="MW"
              value={draft.importLimitMw}
              onChange={(value) => setDraft({ ...draft, importLimitMw: value })}
            />
            <NumberField
              label="Safety Reserve"
              unit="MW"
              value={draft.safetyReserveMw}
              onChange={(value) => setDraft({ ...draft, safetyReserveMw: value })}
            />
            <NumberField
              label="PUE"
              value={draft.pue}
              step="0.01"
              onChange={(value) => setDraft({ ...draft, pue: value })}
            />
            <NumberField
              label="GPU Count"
              value={draft.gpuCount}
              step="1"
              onChange={(value) => setDraft({ ...draft, gpuCount: value })}
            />
            <NumberField
              label="GPU Active Power"
              unit="W"
              value={draft.gpuActivePowerWatts}
              onChange={(value) => setDraft({ ...draft, gpuActivePowerWatts: value })}
            />
            <NumberField
              label="Battery Power"
              unit="MW"
              value={draft.battery.maximumPowerMw}
              onChange={(value) =>
                setDraft({ ...draft, battery: { ...draft.battery, maximumPowerMw: value } })
              }
            />
            <NumberField
              label="Battery Energy"
              unit="MWh"
              value={draft.battery.usableEnergyMwh}
              onChange={(value) =>
                setDraft({ ...draft, battery: { ...draft.battery, usableEnergyMwh: value } })
              }
            />
            <NumberField
              label="Shiftable Workload"
              unit="%"
              value={draft.maximumShiftablePercent}
              onChange={(value) => setDraft({ ...draft, maximumShiftablePercent: value })}
            />
          </div>
          {error ? (
            <p role="alert" className="operations-v2-form-error">
              {error}
            </p>
          ) : null}
          <footer>
            <OperationsEvidenceBadge kind="user_assumption" />
            <button type="submit" className="primary-button">
              Recalculate Scenario
            </button>
          </footer>
        </form>
      ) : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  unit,
  step = "0.1",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  step?: string;
}) {
  const id = `ops-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <label htmlFor={id}>
      {label}
      <span>
        <input
          id={id}
          name={id}
          type="number"
          inputMode="decimal"
          autoComplete="off"
          min="0"
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {unit ? <em>{unit}</em> : null}
      </span>
    </label>
  );
}
