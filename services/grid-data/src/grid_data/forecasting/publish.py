from __future__ import annotations

import json
import urllib.request
from collections.abc import Iterable

from .contracts import FeatureSnapshot, Observation, Prediction
from .features import snapshot_hash


class ForecastStore:
    """Service-role writer for normalized real observations and governed outputs."""

    def __init__(self, url: str, service_role_key: str) -> None:
        if not url.startswith("https://") or not service_role_key:
            raise ValueError("a HTTPS Supabase URL and service-role key are required")
        self.url = url.rstrip("/")
        self.key = service_role_key

    def _request(self, table: str, rows: object, *, prefer: str = "return=representation,resolution=merge-duplicates") -> object:
        request = urllib.request.Request(
            f"{self.url}/rest/v1/{table}", data=json.dumps(rows, default=str).encode(), method="POST",
            headers={"apikey": self.key, "authorization": f"Bearer {self.key}", "content-type": "application/json", "prefer": prefer},
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            content = response.read()
        return json.loads(content) if content else None

    def publish_observations(self, observations: Iterable[Observation], *, batch_size: int = 500) -> int:
        rows = [{"region_code": row.region_code, "metric_key": row.metric_key, "interval_start": row.interval_start.isoformat(), "interval_end": row.interval_end.isoformat(), "issued_at": row.issued_at.isoformat() if row.issued_at else None, "value": row.value, "unit": row.unit, "source_key": row.source_key, "source_record_id": row.source_record_id, "source_url": row.source_url, "retrieved_at": row.retrieved_at.isoformat(), "content_hash": row.content_hash, "quality_flags": list(row.quality_flags)} for row in observations]
        for start in range(0, len(rows), batch_size):
            self._request("grid_context_observations?on_conflict=source_key,source_record_id", rows[start:start + batch_size], prefer="return=minimal,resolution=merge-duplicates")
        return len(rows)

    def publish_snapshot(self, snapshot: FeatureSnapshot) -> dict[str, object]:
        rows = self._request("forecast_feature_snapshots", [{"region_code": snapshot.region_code, "issue_time": snapshot.issue_time.isoformat(), "delivery_day": snapshot.delivery_day.isoformat(), "schema_version": snapshot.schema_version, "features": snapshot.features, "source_observation_ids": list(snapshot.source_ids), "source_evidence_types": list(snapshot.source_evidence_types), "completeness": snapshot.completeness, "content_hash": snapshot_hash(snapshot)}])
        if not isinstance(rows, list) or not rows: raise RuntimeError("feature snapshot publication returned no row")
        return rows[0]

    def publish_prediction(self, prediction: Prediction, *, model_version_id: str, feature_snapshot_id: str) -> dict[str, object]:
        row = {"region_code": prediction.region_code, "issue_time": prediction.issue_time.isoformat(), "delivery_day": prediction.delivery_day.isoformat(), "model_version_id": model_version_id, "feature_snapshot_id": feature_snapshot_id, "high_stress_probability": prediction.high_stress_probability, "redispatch_mwh_p50": prediction.redispatch_mwh_p50, "redispatch_mwh_p90": prediction.redispatch_mwh_p90, "severity": prediction.severity, "confidence": prediction.confidence, "drivers": list(prediction.drivers), "caveats": list(prediction.caveats), "source_freshness": prediction.source_freshness, "status": "published"}
        rows = self._request("grid_stress_predictions", [row])
        if not isinstance(rows, list) or not rows: raise RuntimeError("prediction publication returned no row")
        return rows[0]
