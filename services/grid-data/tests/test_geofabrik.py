from __future__ import annotations

import json
import tempfile
import unittest
from email.message import Message
from pathlib import Path
from unittest.mock import patch

from grid_data.geofabrik import discover_germany_pbf


class FakeResponse:
    def __init__(self, body: bytes = b"", *, status: int = 200, headers: Message | None = None):
        self.body = body
        self.status = status
        self.headers = headers or Message()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self, _limit: int | None = None) -> bytes:
        return self.body


class GeofabrikManifestTests(unittest.TestCase):
    def test_discovery_is_not_an_accepted_release(self) -> None:
        headers = Message()
        headers["content-length"] = "4096"
        headers["etag"] = '"release-etag"'
        responses = [
            FakeResponse(headers=headers),
            FakeResponse(b"0123456789abcdef0123456789abcdef  germany-latest.osm.pbf\n"),
        ]
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "manifest.json"
            with patch("urllib.request.urlopen", side_effect=responses):
                report = discover_germany_pbf(output)
            self.assertFalse(report["accepted"])
            self.assertEqual(report["content_length"], 4096)
            self.assertEqual(report["expected_md5"], "0123456789abcdef0123456789abcdef")
            self.assertEqual(json.loads(output.read_text())["geographic_scope"], "Germany")


if __name__ == "__main__":
    unittest.main()
