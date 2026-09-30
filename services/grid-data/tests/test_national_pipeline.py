from __future__ import annotations

import unittest

from grid_data.national_pipeline import recommended_parse_workers


class NationalPipelineTests(unittest.TestCase):
    def test_default_parse_concurrency_is_bounded(self) -> None:
        self.assertGreaterEqual(recommended_parse_workers(), 1)
        self.assertLessEqual(recommended_parse_workers(), 3)


if __name__ == "__main__":
    unittest.main()
