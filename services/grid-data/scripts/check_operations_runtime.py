"""Read-only release probe. No credentials or facility payloads are printed."""

import argparse
import json
import urllib.error
import urllib.request
from urllib.parse import urlparse


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--revision", required=True)
    args = parser.parse_args()
    parsed = urlparse(args.base_url)
    if parsed.scheme != "https" and parsed.hostname not in {"127.0.0.1", "localhost"}:
        parser.error("Use HTTPS for remote dependency probes")
    results = {}
    for path in ("/health/live", "/health/ready"):
        try:
            with urllib.request.urlopen(args.base_url.rstrip("/") + path, timeout=15) as response:
                body = json.loads(response.read(65536))
                results[path] = (
                    body.get("status") == "ok" and body.get("revision") == args.revision
                    if path.endswith("live")
                    else body.get("ready") is True
                    and body.get("automatic_dispatch_authorized") is False
                )
        except (OSError, ValueError):
            results[path] = False
    print(json.dumps({"checks": results, "status": "pass" if all(results.values()) else "fail"}))
    return 0 if all(results.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
