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
    index = (
        b'<a href="germany-latest.osm.pbf">latest</a>'
        b'<a href="germany-261103.osm.pbf">older</a>'
        b'<a href="germany-261103.osm.pbf.md5">checksum</a>'
        b'<a href="germany-261104.osm.pbf">newest</a>'
        b'<a href="germany-261104.osm.pbf.md5">checksum</a>'
    )

    def test_discovery_is_not_an_accepted_release(self) -> None:
        headers = Message()
        headers["content-length"] = "4096"
        headers["etag"] = '"release-etag"'
        responses = [
            FakeResponse(self.index),
            FakeResponse(headers=headers),
            FakeResponse(b"0123456789abcdef0123456789abcdef  germany-261104.osm.pbf\n"),
        ]
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "manifest.json"
            with patch("urllib.request.urlopen", side_effect=responses) as open_url:
                report = discover_germany_pbf(output)
            self.assertFalse(report["accepted"])
            self.assertEqual(report["content_length"], 4096)
            self.assertEqual(report["expected_md5"], "0123456789abcdef0123456789abcdef")
            self.assertEqual(json.loads(output.read_text())["geographic_scope"], "Germany")
            self.assertTrue(report["url"].endswith("/germany-261104.osm.pbf"))
            self.assertEqual(report["checksum_url"], report["url"] + ".md5")
            requests = [call.args[0] for call in open_url.call_args_list]
            self.assertEqual(requests[1].get_method(), "HEAD")
            self.assertEqual(requests[1].full_url, report["url"])
            self.assertEqual(requests[2].full_url, report["checksum_url"])

    def test_missing_latest_checksum_does_not_silently_select_an_older_release(self) -> None:
        index = self.index.replace(b'<a href="germany-261104.osm.pbf.md5">checksum</a>', b"")
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "manifest.json"
            with (
                patch("urllib.request.urlopen", return_value=FakeResponse(index)),
                self.assertRaisesRegex(RuntimeError, "checksum is missing"),
            ):
                discover_germany_pbf(output)
            self.assertFalse(output.exists())

    def test_publisher_absolute_and_redirect_relative_urls(self) -> None:
        for prefix, base in (
            (
                "https://download.geofabrik.de/europe/germany/",
                "https://download.geofabrik.de/europe/germany.html",
            ),
            ("", "https://download.geofabrik.de/europe/germany/index.html"),
        ):
            with self.subTest(prefix=prefix), tempfile.TemporaryDirectory() as directory:
                index = FakeResponse(
                    self.index.replace(b'href="germany-', f'href="{prefix}germany-'.encode())
                )
                index.geturl = lambda base=base: base
                responses = [
                    index,
                    FakeResponse(),
                    FakeResponse(b"0123456789abcdef0123456789abcdef  germany-261104.osm.pbf"),
                ]
                with patch("urllib.request.urlopen", side_effect=responses):
                    report = discover_germany_pbf(Path(directory) / "manifest.json")
                self.assertEqual(
                    report["url"],
                    "https://download.geofabrik.de/europe/germany/germany-261104.osm.pbf",
                )

    def test_external_release_and_wrong_directory_checksum_fail_closed(self) -> None:
        for index in (
            self.index.replace(b'href="germany-', b'href="https://untrusted.example/germany-'),
            self.index.replace(
                b'href="germany-261104.osm.pbf.md5"',
                b'href="https://download.geofabrik.de/europe/germany/germany-261104.osm.pbf.md5"',
            ),
        ):
            with self.subTest(index=index), tempfile.TemporaryDirectory() as directory:
                output = Path(directory) / "manifest.json"
                with (
                    patch("urllib.request.urlopen", return_value=FakeResponse(index)),
                    self.assertRaises(RuntimeError),
                ):
                    discover_germany_pbf(output)
                self.assertFalse(output.exists())

    def test_invalid_or_mismatched_checksum_cannot_be_accepted(self) -> None:
        for checksum in (
            b"not-a-digest  germany-261104.osm.pbf",
            b"0123456789abcdef0123456789abcdef  germany-261103.osm.pbf",
            b"",
        ):
            with self.subTest(checksum=checksum), tempfile.TemporaryDirectory() as directory:
                output = Path(directory) / "manifest.json"
                responses = [FakeResponse(self.index), FakeResponse(), FakeResponse(checksum)]
                with (
                    patch("urllib.request.urlopen", side_effect=responses),
                    self.assertRaisesRegex(RuntimeError, "invalid Geofabrik checksum"),
                ):
                    discover_germany_pbf(output)
                self.assertFalse(output.exists())

    def test_missing_dated_release_fails_closed(self) -> None:
        with (
            tempfile.TemporaryDirectory() as directory,
            patch("urllib.request.urlopen", return_value=FakeResponse(b"<html></html>")),
            self.assertRaisesRegex(RuntimeError, "did not advertise"),
        ):
            discover_germany_pbf(Path(directory) / "manifest.json")


if __name__ == "__main__":
    unittest.main()
