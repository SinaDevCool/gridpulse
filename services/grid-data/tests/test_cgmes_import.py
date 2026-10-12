import tempfile
import unittest
from pathlib import Path

from grid_data.cgmes_import import inspect_cgmes_files


class CgmesImportTests(unittest.TestCase):
    def test_requires_complete_steady_state_profile_set(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            eq = root / "pilot_EQ.xml"
            eq.write_text("<rdf />", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "SSH, SV, TP"):
                inspect_cgmes_files([eq])

    def test_hashes_complete_profile_set_deterministically(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = []
            for profile in ("EQ", "SSH", "TP", "SV"):
                path = root / f"pilot_{profile}.xml"
                path.write_text(f"<{profile} />", encoding="utf-8")
                paths.append(path)
            left = inspect_cgmes_files(paths)
            right = inspect_cgmes_files(list(reversed(paths)))
            self.assertEqual(left["profiles"], ["EQ", "SSH", "SV", "TP"])
            self.assertEqual(left["sha256"], right["sha256"])


if __name__ == "__main__":
    unittest.main()
