from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone


@dataclass(frozen=True)
class RedispatchEvent:
    start: datetime
    end: datetime
    power_mw: float
    published_at: datetime
    source_record_id: str


@dataclass(frozen=True)
class DailyTarget:
    delivery_day: date
    redispatch_mwh: float
    event_count: int
    coverage_complete: bool


def aggregate_daily_targets(events: Iterable[RedispatchEvent], *, complete_days: set[date]) -> list[DailyTarget]:
    energy: dict[date, float] = {day: 0.0 for day in complete_days}
    counts: dict[date, int] = {day: 0 for day in complete_days}
    for event in events:
        if event.start.tzinfo is None or event.end.tzinfo is None or event.end <= event.start:
            raise ValueError("redispatch events require valid timezone-aware intervals")
        cursor = event.start.astimezone(timezone.utc)
        end = event.end.astimezone(timezone.utc)
        while cursor < end:
            boundary = datetime.combine(cursor.date(), datetime.min.time(), timezone.utc) + timedelta(days=1)
            segment_end = min(boundary, end)
            day = cursor.date()
            if day in complete_days:
                energy[day] += abs(event.power_mw) * (segment_end - cursor).total_seconds() / 3600
                counts[day] += 1
            cursor = segment_end
    return [DailyTarget(day, energy[day], counts[day], True) for day in sorted(complete_days)]


def percentile(values: list[float], quantile: float) -> float:
    if not values or not 0 <= quantile <= 1:
        raise ValueError("a non-empty sample and quantile in [0,1] are required")
    ordered = sorted(values)
    position = (len(ordered) - 1) * quantile
    low, high = int(position), min(int(position) + 1, len(ordered) - 1)
    fraction = position - low
    return ordered[low] * (1 - fraction) + ordered[high] * fraction
