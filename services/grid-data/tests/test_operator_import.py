from __future__ import annotations

import unittest

from grid_data.operator_import import validate_operator_import_manifest


class OperatorImportTests(unittest.TestCase):
    def test_rejects_public_map_without_documented_reuse_permission(self) -> None:
        result = validate_operator_import_manifest(
            {
                "source_id": "50hertz-netzanschluss-2026",
                "reuse_status": "awaiting_permission",
                "redistribution_permitted": False,
                "records": [],
            }
        )
        self.assertFalse(result.valid)
        self.assertIn("reuse_status must be permitted", result.errors)
        self.assertIn("redistribution_permitted must be true", result.errors)

    def test_accepts_well_formed_permitted_manifest(self) -> None:
        result = validate_operator_import_manifest(
            {
                "source_id": "operator-source",
                "reuse_status": "permitted",
                "redistribution_permitted": True,
                "reuse_basis": "Written permission dated 2026-07-23",
                "evidence_url": "https://operator.example/reuse",
                "records": [
                    {
                        "source_record_id": "node-1",
                        "direction": "demand",
                        "latitude": 52.5,
                        "longitude": 13.4,
                    }
                ],
            }
        )
        self.assertTrue(result.valid)
        self.assertEqual(result.record_count, 1)


if __name__ == "__main__":
    unittest.main()
