import { useState } from "react";
import { stableOperationsJson } from "@/lib/operations-request";
import { operationsScenarioSchema, type OperationsScenario } from "../scenario-engine";
import { scenarioFieldId } from "./scenario-fields";
export function useScenarioDraft(
  applied: OperationsScenario,
  onApply: (value: OperationsScenario) => void,
) {
  const [draft, setDraft] = useState(applied);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = stableOperationsJson(draft) !== stableOperationsJson(applied);
  function apply() {
    const result = operationsScenarioSchema.safeParse(draft);
    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
        ),
      );
      const field = document.getElementById(scenarioFieldId(result.error.issues[0].path.join(".")));
      for (let parent = field?.parentElement; parent; parent = parent.parentElement)
        if (parent instanceof HTMLDetailsElement) parent.open = true;
      field?.focus();
      return;
    }
    setErrors({});
    setDraft(result.data);
    onApply(result.data);
  }
  return {
    draft,
    setDraft,
    dirty,
    errors,
    apply,
    discard() {
      setDraft(applied);
      setErrors({});
    },
  };
}
