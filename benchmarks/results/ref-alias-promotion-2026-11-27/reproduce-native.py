from pathlib import Path
import argparse
import hashlib
import json
import subprocess

BASE = Path('/workspace/scratch/eb5e4be57451')
HERE = Path(__file__).resolve().parent
REPO = BASE / 'similarity-v3-ref-aliases'
FIXTURES = REPO / 'tests/fixtures/ref-alias-promotion'
NODE = '/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node'
PINS = {'9d': (BASE / 'reference-luau-ci', BASE / 'quality-research/v2-call-boundary-probe/run-bytecode-9d'),
        'c875': (BASE / 'reference-luau', BASE / 'quality-research/v2-call-boundary-probe/run-bytecode-c875')}
PROFILES = ['O0g1', 'O0g2', 'O1g1', 'O1g2', 'O2g1', 'O2g2']
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
parser = argparse.ArgumentParser()
parser.add_argument('--label', required=True)
parser.add_argument('--engine', type=Path, required=True)
parser.add_argument('--seal', action='store_true')
args = parser.parse_args()
OUT = HERE / args.label
OUT.mkdir(exist_ok=False)
commands, results = [], []


def run(command, prefix):
    command = list(map(str, command))
    process = subprocess.run(command, capture_output=True, timeout=25)
    for stream in ['stdout', 'stderr']:
        with prefix.with_suffix('.' + stream).open('xb') as output:
            output.write(getattr(process, stream))
    row = {'command': command, 'exitCode': process.returncode,
           'stdout': str(prefix.with_suffix('.stdout').relative_to(OUT)),
           'stderr': str(prefix.with_suffix('.stderr').relative_to(OUT))}
    commands.append(row)
    with (OUT / 'commands.jsonl').open('a') as output:
        json.dump(row, output)
        output.write('\n')
    return process


if args.seal:
    manifest = {'sources': [{'path': path.name, 'sha256': sha(path)} for path in sorted(FIXTURES.glob('*.luau'))],
                'inputs': [], 'pins': {}}
    assert len(manifest['sources']) == 3
else:
    manifest = json.loads((FIXTURES / 'manifest.json').read_text())
    for entry in [*manifest['sources'], *manifest['inputs']]:
        assert sha(FIXTURES / entry['path']) == entry['sha256']
    prior = json.loads((HERE / 'first-before/summary.json').read_text())
    prior_records = {row['id']: row for row in prior['results']}

for pin, (tree, host) in PINS.items():
    compiler = tree / 'build/release/luau-compile'
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=tree, text=True).strip()
    pin_info = {'revision': revision, 'compilerSha256': sha(compiler), 'hostSha256': sha(host)}
    if args.seal:
        manifest['pins'][pin] = pin_info
    else:
        assert manifest['pins'][pin] == pin_info
    for source in manifest['sources']:
        stem = Path(source['path']).stem
        for profile in PROFILES:
            identity = pin + '/' + stem + '/' + profile
            folder = OUT / pin / stem / profile
            folder.mkdir(parents=True)
            binary = FIXTURES / (pin + '-' + stem + '-' + profile + '.luauc')
            flags = ['-O' + profile[1], '-g' + profile[3]]
            if args.seal:
                if stem == 'rejected-state':
                    original_path = BASE / 'quality-research/v3-shared-guards/first-baseline' / pin / stem / (profile + '.luauc')
                    with binary.open('xb') as output:
                        output.write(original_path.read_bytes())
                    origin = str(original_path)
                else:
                    compiled = run([compiler, '--binary', *flags, FIXTURES / source['path']], folder / 'original-compile')
                    assert compiled.returncode == 0
                    with binary.open('xb') as output:
                        output.write(compiled.stdout)
                    origin = 'Compiled once from the unchanged authored source with the recorded compiler.'
                manifest['inputs'].append({'path': binary.name, 'pin': pin, 'profile': profile,
                                           'source': source['path'], 'sha256': sha(binary), 'origin': origin})
            original = run([host, binary], folder / 'original-run')
            decompiled = run([NODE, args.engine / 'cli.js', 'decompile', binary], folder / 'decompile')
            recovered = folder / 'output.luau'
            with recovered.open('xb') as output:
                output.write(decompiled.stdout)
            recompiled = run([compiler, '--binary', *flags, recovered], folder / 'output-compile')
            recovered_binary = folder / 'output.luauc'
            with recovered_binary.open('xb') as output:
                output.write(recompiled.stdout)
            observed = run([host, recovered_binary], folder / 'output-run')
            original_result = {'exitCode': original.returncode, 'stdout': original.stdout.decode(), 'stderr': original.stderr.decode()}
            actual_result = {'exitCode': observed.returncode, 'stdout': observed.stdout.decode(), 'stderr': observed.stderr.decode()}
            row = {'id': identity, 'pin': pin, 'source': source['path'], 'profile': profile,
                   'inputSha256': sha(binary), 'original': original_result, 'actual': actual_result,
                   'decompileExitCode': decompiled.returncode, 'recompileExitCode': recompiled.returncode,
                   'sourceSha256': sha(recovered), 'outputBytecodeSha256': sha(recovered_binary),
                   'match': original.returncode == 0 and decompiled.returncode == 0 and recompiled.returncode == 0
                            and observed.returncode == 0 and original.stdout == observed.stdout and original.stderr == observed.stderr}
            if not args.seal:
                row['originalObservationUnchanged'] = original_result == prior_records[identity]['original']
                assert row['originalObservationUnchanged']
            results.append(row)
            with (OUT / 'results.jsonl').open('a') as output:
                json.dump(row, output)
                output.write('\n')

if args.seal:
    with (FIXTURES / 'manifest.json').open('x') as output:
        json.dump(manifest, output, indent=2)
        output.write('\n')
summary = {'purpose': 'Exact saved-bytecode round trips for aliases preceding first REF capture.',
           'label': args.label, 'engineDist': str(args.engine), 'profiles': len(results),
           'pass': sum(row['match'] for row in results), 'fail': sum(not row['match'] for row in results),
           'pins': manifest['pins'], 'manifestSha256': sha(FIXTURES / 'manifest.json'),
           'perPin': {pin: {'profiles': sum(row['pin'] == pin for row in results),
                           'matches': sum(row['pin'] == pin and row['match'] for row in results)} for pin in PINS},
           'results': results}
with (OUT / 'summary.json').open('x') as output:
    json.dump(summary, output, indent=2)
    output.write('\n')
print(json.dumps({key: summary[key] for key in ['label', 'profiles', 'pass', 'fail', 'perPin']}), flush=True)
raise SystemExit(0 if summary['fail'] == 0 else 1)
