from __future__ import annotations

import unittest

from grid_data.operator_evidence import OFFICIAL_SOURCES, parse_operator_page


class OperatorEvidenceTests(unittest.TestCase):
    def test_parser_keeps_capacity_empty_without_explicit_record_extractor(self) -> None:
        page = b"""
        <html><head><title>Netzanschluss</title></head>
        <body><p>Maximal verfuegbare Anschlussleistung: 100 MW</p>
        <iframe src="/map"></iframe></body></html>
        """
        record = parse_operator_page(OFFICIAL_SOURCES[0], page, "2026-07-23T00:00:00+00:00")
        self.assertEqual(record["page"]["title"], "Netzanschluss")
        self.assertEqual(record["capacity_observations"], [])
        self.assertIn("/map", record["page"]["links"])
        self.assertEqual(len(record["http"]["sha256"]), 64)

    def test_source_registry_marks_edis_monitor_as_not_demand_relevant(self) -> None:
        monitor = next(source for source in OFFICIAL_SOURCES if source.endpoint_key == "generation-monitor")
        self.assertEqual(monitor.demand_relevance, "none")
        self.assertIn("not evidence of demand headroom", monitor.legal_boundary)


if __name__ == "__main__":
    unittest.main()
