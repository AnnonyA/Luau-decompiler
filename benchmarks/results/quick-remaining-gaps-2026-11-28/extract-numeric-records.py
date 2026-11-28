#!/usr/bin/env python3
"""Archive existing observations; never run a decompiler, scorer or VM."""
import gzip
import hashlib
import json
import sys
from pathlib import Path

first, cache, destination = map(Path, sys.argv[1:])
summary = json.loads((first / "summary.json").read_text())


def digest(data):
    return {"sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}


rows = []
for path in sorted(first.glob("seed*-O*g*.json")):
    raw = path.read_bytes()
    original = json.loads(raw)
    cached = json.loads((cache / (original["id"] + ".json")).read_text())
    assert cached["source"] == original["source"]
    assert cached["quality"]["similarity"] == original["baselineQuality"]["similarity"]
    bytecode = Path(original["bytecodePath"])
    bytecode_digest = digest(bytecode.read_bytes())
    assert bytecode_digest["sha256"] == original["bytecodeSha256"]
    row = {
        "id": original["id"],
        "firstRecord": {"path": str(path), **digest(raw)},
        "bytecode": {"path": str(bytecode), **bytecode_digest},
        "source": digest(original["source"].encode()),
        "baselineOutput": digest(original["baselineOutput"].encode()),
        "baselineQuality": original["baselineQuality"],
        "projections": {},
    }
    for mode, projection in original["projections"].items():
        assert projection["delta"] == 100 * (
            projection["quality"]["similarity"] - original["baselineQuality"]["similarity"]
        )
        row["projections"][mode] = {
            "events": projection["events"],
            "quality": projection["quality"],
            "delta": projection["delta"],
            "output": (
                {"recorded": True, **digest(projection["output"].encode())}
                if "output" in projection else {"recorded": False, "reason": "No transformation events"}
            ),
        }
    rows.append(row)

assert len(rows) == 300 == summary["projectedGeneratedProfiles"]
for mode, expected in summary["modes"].items():
    projections = [row["projections"][mode] for row in rows]
    total = 0.0
    for projection in projections:
        total += projection["delta"]
    observed = {
        "movedDeclarations": sum(len(p["events"]) for p in projections),
        "affectedProfiles": sum(bool(p["events"]) for p in projections),
        "projectedGlobalDeltaPoints": total / 882,
        "projectedGeneratedDeltaPoints": total / 300,
        "better": sum(p["delta"] > 0 for p in projections),
        "equal": sum(p["delta"] == 0 for p in projections),
        "worse": sum(p["delta"] < 0 for p in projections),
    }
    assert all(expected[key] == value for key, value in observed.items()), (mode, observed)

data = (json.dumps({
    "format": "compact-existing-nonadjacent-observations",
    "behaviorVerified": False,
    "scope": "300 generated profiles; remaining 582 Quick profiles unchanged",
    "omissions": "Source/output strings omitted; hashes refer to intact original records.",
    "records": rows,
}, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
with destination.open("xb") as stream:
    stream.write(data)
compressed = gzip.compress(data, compresslevel=9, mtime=0)
assert gzip.decompress(compressed) == data
with destination.with_suffix(destination.suffix + ".gz").open("xb") as stream:
    stream.write(compressed)
print(json.dumps({"records": len(rows), "raw": digest(data), "gzip": digest(compressed)}))
