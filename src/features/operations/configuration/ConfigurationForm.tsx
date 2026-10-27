import type { ReactNode } from "react";
import type { OperationsScenario } from "../scenario-engine";
import { Check, CircleDot, LoaderCircle, RotateCcw, Undo2 } from "lucide-react";
import {
  readScenarioField,
  scenarioFieldGroups,
  scenarioFieldId,
  updateScenarioField,
} from "./scenario-fields";
type Props = {
  children?: ReactNode;
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
      id="ops-scenario-form"
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
      {props.children}
      {scenarioFieldGroups
        .filter((group) => group.title !== "Battery advanced")
        .map((group) => (
          <details key={group.title} open={"open" in group ? group.open : undefined}>
            <summary>{group.title}</summary>
            {group.fields.map(([path, label, unit]) => (
              <ScenarioNumberField key={path} {...props} path={path} label={label} unit={unit} />
            ))}
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
            {group.title === "Battery" ? (
              <>
                <details className="ops-battery-advanced">
                  <summary>Advanced battery settings</summary>
                  {scenarioFieldGroups
                    .find((item) => item.title === "Battery advanced")!
                    .fields.map(([path, label, unit]) => (
                      <ScenarioNumberField
                        key={path}
                        {...props}
                        path={path}
                        label={label}
                        unit={unit}
                      />
                    ))}
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
                          battery: {
                            ...props.draft.battery,
                            inverterAvailable: event.target.checked,
                          },
                        })
                      }
                    />
                    Inverter available
                  </label>
                </details>
              </>
            ) : null}
          </details>
        ))}
      {Object.keys(props.errors).length ? (
        <p role="alert" className="ops-field-error">
          Check the highlighted scenario assumptions.
        </p>
      ) : null}
    </form>
  );
}

export function ConfigurationActions(props: Pick<Props, "busy" | "dirty" | "onDiscard"> & { milp?: boolean }) {
  return (
    <footer
      className="ops-configuration-actions"
      role="group"
      aria-label="Scenario actions"
      data-state={props.busy ? "busy" : props.dirty ? "dirty" : "applied"}
    >
      <p role="status" className="ops-configuration-state">
        {props.busy ? (
          <LoaderCircle aria-hidden="true" />
        ) : props.dirty ? (
          <CircleDot aria-hidden="true" />
        ) : (
          <Check aria-hidden="true" />
        )}
        {props.busy
          ? props.milp ? "Optimising plan…" : "Calculating scenario…"
          : props.dirty
            ? "Changes ready to apply"
            : props.milp ? "Plan inputs ready" : "Scenario inputs applied"}
      </p>
      <small>
        {props.dirty
          ? "Results use the previous inputs until recalculated."
          : "What-if assessment · no equipment commands"}
      </small>
      <button
        className="primary-button"
        type="submit"
        form="ops-scenario-form"
        disabled={props.busy}
        aria-busy={props.busy}
      >
        {props.busy ? <LoaderCircle aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
        <span>{props.busy ? "Calculating…" : props.milp ? "Optimise plan" : "Recalculate Scenario"}</span>
      </button>
      <button
        className="secondary-button"
        type="button"
        disabled={!props.dirty || props.busy}
        onClick={props.onDiscard}
      >
        <Undo2 aria-hidden="true" /> Discard changes
      </button>
    </footer>
  );
}
function ScenarioNumberField(
  props: Pick<Props, "draft" | "errors" | "onChange"> & {
    path: string;
    label: string;
    unit: string;
  },
) {
  const { path, label, unit } = props;
  const id = scenarioFieldId(path),
    value = readScenarioField(props.draft, path);
  return (
    <label htmlFor={id}>
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
}
