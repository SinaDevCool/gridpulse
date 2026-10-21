import type { OperationsScenario } from "../scenario-engine";
import {
  readScenarioField,
  scenarioFieldGroups,
  scenarioFieldId,
  updateScenarioField,
} from "./scenario-fields";
type Props = {
  draft: OperationsScenario;
  onChange: (value: OperationsScenario) => void;
  errors: Record<string, string>;
  dirty: boolean;
  busy: boolean;
  historical: boolean;
  onApply: () => void;
  onDiscard: () => void;
};
/** Single form shared by docked panel and mobile drawer. */
export function ConfigurationForm(props: Props) {
  return (
    <form
      className="ops-configuration-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        props.onApply();
      }}
    >
      <p className="ops-input-note">
        {props.historical
          ? "Scenario assumptions do not overwrite uploaded measurements. The configured limit is the analysis reference, not a verified contract."
          : "Editable scenario assumptions, not measured facility data."}
      </p>
      {scenarioFieldGroups.map((group) => (
        <details key={group.title} open={"open" in group ? group.open : undefined}>
          <summary>{group.title}</summary>
          {group.fields.map(([path, label, unit]) => {
            const id = scenarioFieldId(path),
              value = readScenarioField(props.draft, path);
            return (
              <label key={path} htmlFor={id}>
                {label} <span className="ops-field-unit">{unit}</span>
                <input
                  id={id}
                  name={path}
                  type="number"
                  inputMode="decimal"
                  autoComplete="off"
                  step={unit === "ratio" ? "0.01" : unit === "GPUs" || unit === "min" ? "1" : "0.1"}
                  value={Number.isFinite(value) ? value : ""}
                  aria-invalid={Boolean(props.errors[path])}
                  aria-describedby={props.errors[path] ? `${id}-error` : undefined}
                  onChange={(event) =>
                    props.onChange(
                      updateScenarioField(
                        props.draft,
                        path,
                        event.target.value === "" ? NaN : Number(event.target.value),
                      ),
                    )
                  }
                />
                {props.errors[path] ? (
                  <small id={`${id}-error`} className="ops-field-error">
                    {props.errors[path]}
                  </small>
                ) : null}
              </label>
            );
          })}
          {group.title === "Facility limits" ? (
            <p>
              Safety target:{" "}
              {Number.isFinite(props.draft.importLimitMw - props.draft.safetyReserveMw)
                ? `${props.draft.importLimitMw - props.draft.safetyReserveMw} MW`
                : "Check inputs"}
            </p>
          ) : null}
          {group.title === "Compute & flexibility" ? (
            <label htmlFor="ops-gpuModel">
              GPU model
              <input
                id="ops-gpuModel"
                name="gpuModel"
                value={props.draft.gpuModel}
                onChange={(event) =>
                  props.onChange({ ...props.draft, gpuModel: event.target.value })
                }
                aria-invalid={Boolean(props.errors.gpuModel)}
                aria-describedby={props.errors.gpuModel ? "ops-gpuModel-error" : undefined}
              />
              {props.errors.gpuModel ? (
                <small id="ops-gpuModel-error" className="ops-field-error">
                  {props.errors.gpuModel}
                </small>
              ) : null}
            </label>
          ) : null}
          {group.title === "Battery advanced" ? (
            <>
              <label className="ops-check">
                <input
                  type="checkbox"
                  checked={props.draft.battery.available}
                  onChange={(event) =>
                    props.onChange({
                      ...props.draft,
                      battery: { ...props.draft.battery, available: event.target.checked },
                    })
                  }
                />
                Battery available
              </label>
              <label className="ops-check">
                <input
                  type="checkbox"
                  checked={props.draft.battery.inverterAvailable}
                  onChange={(event) =>
                    props.onChange({
                      ...props.draft,
                      battery: { ...props.draft.battery, inverterAvailable: event.target.checked },
                    })
                  }
                />
                Inverter available
              </label>
            </>
          ) : null}
        </details>
      ))}
      {Object.keys(props.errors).length ? (
        <p role="alert" className="ops-field-error">
          Check the highlighted scenario assumptions.
        </p>
      ) : null}
      <footer className="ops-configuration-actions">
        <p role="status">
          {props.busy
            ? "Calculation pending…"
            : props.dirty
              ? "Unapplied changes · results use the applied configuration"
              : "Applied scenario assumptions"}
        </p>
        <button className="primary-button" type="submit" disabled={props.busy}>
          Recalculate Scenario
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={!props.dirty}
          onClick={props.onDiscard}
        >
          Discard changes
        </button>
      </footer>
    </form>
  );
}
