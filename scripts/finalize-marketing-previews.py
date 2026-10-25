"""Encode genuine browser captures and record the exact public asset identities."""
import hashlib
import json
from pathlib import Path

from PIL import Image

root = Path("marketing-captures")
provenance_path = root / "provenance.json"
provenance = json.loads(provenance_path.read_text())
assets = {}
for view in ("overview", "workloads", "battery", "mobile"):
    source = root / f"facility-operations-{view}.png"
    target = source.with_suffix(".webp")
    with Image.open(source) as image:
        expected = (390, 1100) if view == "mobile" else (1600, 1400)
        if image.size != expected:
            raise ValueError(f"Unexpected capture dimensions: {view}: {image.size}")
        image.save(target, quality=85)
    content = target.read_bytes()
    if len(content) > 500_000:
        raise ValueError(f"Preview exceeds 500 kB budget: {target.name}")
    assets[target.name] = {"width": expected[0], "height": expected[1],
        "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}
provenance["assets"] = assets
provenance_path.write_text(json.dumps(provenance, indent=2) + "\n")
print(json.dumps({"encoded_previews": len(assets), "bytes": sum(a["bytes"] for a in assets.values())}))
