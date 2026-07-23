from __future__ import annotations

import unittest

from grid_data.operator_health_publish import _source_id


class OperatorHealthPublishTests(unittest.TestCase):
    def test_routes_known_endpoints_to_their_source(self) -> None:
        self.assertEqual(
            _source_id("generation-monitor"),
            "edis-netzanschluss-public-2026",
        )
        self.assertEqual(
            _source_id("connection-process"),
            "50hertz-netzanschluss-2026",
        )


if __name__ == "__main__":
    unittest.main()
