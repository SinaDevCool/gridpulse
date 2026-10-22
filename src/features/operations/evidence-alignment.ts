import type { BatteryObservation, FacilityPowerObservation } from "./battery-dispatch";
import { chronologicalEvidence } from "./evidence-validation";

/** Last known BMS state only; no future samples or invented interpolation. */
export function alignPowerEvidence(
  facility: FacilityPowerObservation[],
  battery: BatteryObservation[],
  toleranceMs = 300_000,
) {
  const ordered = chronologicalEvidence(battery);
  let cursor = -1;
  return chronologicalEvidence(facility).map((point) => {
    const instant = Date.parse(point.timestamp);
    while (cursor + 1 < ordered.length && Date.parse(ordered[cursor + 1].timestamp) <= instant)
      cursor++;
    const candidate = ordered[cursor];
    return {
      ...point,
      battery:
        candidate && instant - Date.parse(candidate.timestamp) <= toleranceMs ? candidate : null,
    };
  });
}
