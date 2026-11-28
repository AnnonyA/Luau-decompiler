"""Execute sealed presentation controls against both official compiler/VM pins."""
from pathlib import Path
import argparse
import concurrent.futures
import hashlib
import json
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--engine", type=Path, required=True)
parser.add_argument("--baseline-dist", type=Path, required=True)
parser.add_argument("--luau-ci", type=Path, required=True)
parser.add_argument("--luau-rosetta", type=Path, required=True)
parser.add_argument("--node", default="node")
parser.add_argument("--loop-manifest", default="completed-manifest.json")
parser.add_argument("--out", type=Path, required=True)
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=False)
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
pins = {"9d": args.luau_ci, "c875": args.luau_rosetta}
hosts = {}
pin_receipts = {}
for pin, root in pins.items():
    host = args.out / ("run-bytecode-" + pin)
    support = args.engine / "tests/fixtures/format-interpolation/run-bytecode.cpp"
    build = root / "build/release"
    command = ["c++", "-O2", "-std=c++17", "-I", str(root / "VM/include"), str(support),
               str(build / "libluauvm.a"), str(build / "libluaucommon.a"), "-o", str(host)]
    subprocess.run(command, check=True, capture_output=True, timeout=60)
    hosts[pin] = host
    pin_receipts[pin] = {"revision": subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip(),
                         "compilerSha256": sha(build / "luau-compile"), "hostSha256": sha(host), "hostSourceSha256": sha(support),
                         "hostBuild": command}

rows = []
for group, manifest_name in [("loop-exit-guards", args.loop_manifest),
                             ("loop-exit-guards", "review-manifest.json"),
                             ("format-interpolation", "manifest.json"),
                             ("format-interpolation", "review-manifest.json")]:
    folder = args.engine / "tests/fixtures" / group
    manifest = json.loads((folder / manifest_name).read_text())
    assert sha(folder / manifest["source"]) == manifest["sourceSha256"]
    for entry in manifest["inputs"]:
        path = folder / entry["path"]
        assert sha(path) == entry["sha256"]
        rows.append({**entry, "group": group, "file": path})

def check(row):
    folder = args.out / row["group"] / Path(row["path"]).stem
    folder.mkdir(parents=True)
    commands = []

    def run(command, name):
        command = list(map(str, command))
        result = subprocess.run(command, capture_output=True, timeout=30)
        (folder / (name + ".stdout")).write_bytes(result.stdout)
        (folder / (name + ".stderr")).write_bytes(result.stderr)
        commands.append({"command": command, "exitCode": result.returncode, "stdout": name + ".stdout", "stderr": name + ".stderr"})
        return result

    original = run([hosts[row["pin"]], row["file"]], "original")
    variants = {}
    for variant, dist in [("baseline", args.baseline_dist), ("candidate", args.engine / "dist")]:
        decompile = run([args.node, dist / "cli.js", "decompile", row["file"]], variant + "-decompile")
        source = folder / (variant + ".luau")
        source.write_bytes(decompile.stdout)
        compiler = pins[row["pin"]] / "build/release/luau-compile"
        profile = row["profile"]
        compiled = run([compiler, "--binary", "-O" + profile[1], "-g" + profile[3], source], variant + "-compile")
        bytecode = folder / (variant + ".luauc")
        bytecode.write_bytes(compiled.stdout)
        actual = run([hosts[row["pin"]], bytecode], variant + "-actual")
        variants[variant] = {"match": original.returncode == decompile.returncode == compiled.returncode == actual.returncode == 0 and
                            original.stdout == actual.stdout and original.stderr == actual.stderr,
                            "exitCodes": [original.returncode, decompile.returncode, compiled.returncode, actual.returncode],
                            "sourceSha256": sha(source), "bytecodeSha256": sha(bytecode)}
    (folder / "commands.json").write_text(json.dumps(commands, indent=2) + "\n")
    return {**{key: value for key, value in row.items() if key != "file"}, "variants": variants}

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(check, rows))
summary = {"groups": sorted({row["group"] for row in results}), "inputs": len(results),
           "profilesPerProgram": 12, "pinReceipts": pin_receipts, "node": subprocess.check_output([args.node, "--version"], text=True).strip(),
           "baseline": {"pass": sum(row["variants"]["baseline"]["match"] for row in results), "total": len(results)},
           "candidate": {"pass": sum(row["variants"]["candidate"]["match"] for row in results), "total": len(results)},
           "results": results}
(args.out / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps({key: value for key, value in summary.items() if key not in ["results", "pinReceipts"]}, indent=2))
raise SystemExit(0 if summary["candidate"]["pass"] == len(results) else 1)
