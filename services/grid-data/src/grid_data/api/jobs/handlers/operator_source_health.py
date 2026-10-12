from __future__ import annotations

import tempfile
from pathlib import Path

from grid_data.api.jobs.context import JobContext
from grid_data.api.models import AnalyticsJob
from grid_data.operator_evidence import fetch_operator_sources


def calculate(context: JobContext, job: AnalyticsJob) -> dict:
    with tempfile.TemporaryDirectory(prefix="gridpulse-operator-health-") as directory:
        output = Path(directory) / "operator-evidence.json"
        evidence = fetch_operator_sources(output)
        context.checkpoint()
        publication = context.publisher.operator_health(output)
    result = {
        "source_valid": evidence["valid"],
        "record_count": evidence["record_count"],
        "expected_count": evidence["expected_count"],
        **publication,
    }
    return result
