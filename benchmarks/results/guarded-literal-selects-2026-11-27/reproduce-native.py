"""Execute sealed authored bytecodes and recompiled output on both Luau pins."""
from pathlib import Path
import argparse, concurrent.futures, hashlib, json, subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--dist', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--references', type=Path, default=Path('/workspace/scratch/eb5e4be57451'))
parser.add_argument('--node', default='/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node')
args = parser.parse_args()
repo = Path(__file__).resolve().parents[3]
fixtures = repo / 'tests/fixtures/guarded-literal-selects'
manifest = json.loads((fixtures / 'manifest.json').read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
for source in manifest['sources']:
    assert sha(fixtures / source['path']) == source['sha256']
for row in manifest['inputs']:
    assert sha(fixtures / row['path']) == row['sha256']
args.out.mkdir(parents=True, exist_ok=False)
refs = args.references
pins = {
    '9d': (refs / 'reference-luau-ci/build/release/luau-compile', refs / 'quality-research/v2-call-boundary-probe/run-bytecode-9d'),
    'c875': (refs / 'reference-luau/build/release/luau-compile', refs / 'quality-research/v2-call-boundary-probe/run-bytecode-c875'),
}

def check(row):
    folder = args.out / Path(row['path']).stem
    folder.mkdir()
    compiler, host = pins[row['pin']]
    commands = []
    def run(command, label):
        command = list(map(str, command))
        result = subprocess.run(command, capture_output=True, timeout=30)
        (folder / (label + '.stdout')).write_bytes(result.stdout)
        (folder / (label + '.stderr')).write_bytes(result.stderr)
        commands.append({'command': command, 'exitCode': result.returncode})
        return result
    original = run([host, fixtures / row['path']], 'original')
    output = run([args.node, args.dist / 'cli.js', 'decompile', fixtures / row['path']], 'decompile')
    (folder / 'output.luau').write_bytes(output.stdout)
    compiled = run([compiler, '--binary', '-O' + row['profile'][1], '-g' + row['profile'][3], folder / 'output.luau'], 'compile')
    (folder / 'output.luauc').write_bytes(compiled.stdout)
    actual = run([host, folder / 'output.luauc'], 'actual')
    result = {**row, 'commands': commands,
        'original': {'exitCode': original.returncode, 'stdout': original.stdout.decode(), 'stderr': original.stderr.decode()},
        'actual': {'exitCode': actual.returncode, 'stdout': actual.stdout.decode(), 'stderr': actual.stderr.decode()},
        'outputSourceSha256': sha(folder / 'output.luau'), 'outputBytecodeSha256': sha(folder / 'output.luauc')}
    result['match'] = all(r.returncode == 0 for r in [original, output, compiled, actual]) and original.stdout == actual.stdout and original.stderr == actual.stderr
    (folder / 'observation.json').write_text(json.dumps(result, indent=2) + '\n')
    return result

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(check, manifest['inputs']))
summary = {'dist': str(args.dist), 'node': args.node, 'total': len(results), 'passed': sum(r['match'] for r in results),
    'pins': {p: {'compilerSha256': sha(paths[0]), 'hostSha256': sha(paths[1])} for p, paths in pins.items()}, 'results': results}
(args.out / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps({k: v for k, v in summary.items() if k != 'results'}))
raise SystemExit(0 if summary['passed'] == summary['total'] else 1)
