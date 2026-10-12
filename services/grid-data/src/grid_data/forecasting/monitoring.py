from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime, timedelta
from math import log


def freshness_gate(latest: Mapping[str, datetime], *, now: datetime, mandatory: Sequence[str], maximum_age: timedelta = timedelta(hours=36)) -> dict[str, object]:
    stale = [key for key in mandatory if key not in latest or now - latest[key] > maximum_age]
    return {"passed": not stale, "staleSources": stale, "checkedAt": now.isoformat(), "maximumAgeHours": maximum_age.total_seconds() / 3600}


def population_stability_index(reference: Sequence[float], current: Sequence[float], bins: int = 10) -> float:
    if not reference or not current:
        raise ValueError("reference and current samples are required")
    low, high = min(reference + current), max(reference + current)
    if low == high: return 0.0
    width = (high - low) / bins
    score = 0.0
    for index in range(bins):
        lower, upper = low + index * width, low + (index + 1) * width
        ref = max(sum(lower <= v < upper or (index == bins - 1 and v == upper) for v in reference) / len(reference), 1e-6)
        cur = max(sum(lower <= v < upper or (index == bins - 1 and v == upper) for v in current) / len(current), 1e-6)
        score += (cur - ref) * log(cur / ref)
    return score
