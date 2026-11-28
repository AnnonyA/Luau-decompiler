from pathlib import Path
import concurrent.futures, hashlib, json, subprocess, sys

ROOT = Path('/workspace/scratch/1c4124dc88e4')
REPO = ROOT/'Luau-decompiler'
FIXTURES = REPO/'tests/fixtures/named-table-closures'
OUT = ROOT/'measurements/named-table-native-first'
OUT.mkdir(exist_ok=False)
NODE = '/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node'
OLD = Path('/workspace/scratch/eb5e4be57451')
PINS = {'9d': ('9d7748a4f324213a18cb8283fa2a77c330225fa0', OLD/'reference-luau-ci/build/release/luau-compile', OLD/'quality-research/v2-call-boundary-probe/run-bytecode-9d'),
        'c875': ('c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f', OLD/'reference-luau/build/release/luau-compile', OLD/'quality-research/v2-call-boundary-probe/run-bytecode-c875')}
ENGINES = {'baseline': ROOT/'measurements/baseline-replay/engine-dist', 'candidate': ROOT/'measurements/named-table-v1/engine-dist'}
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
manifest = {'sources': [{'path': p.name, 'sha256': sha(p)} for p in sorted(FIXTURES.glob('*.luau'))], 'inputs': [],
            'pins': {key: {'revision': pin[0], 'compilerSha256': sha(pin[1]), 'hostSha256': sha(pin[2])} for key, pin in PINS.items()}}
for source in manifest['sources']:
    for pin, (_, compiler, _) in PINS.items():
        for opt in range(3):
            for debug in [1, 2]:
                profile = f'O{opt}g{debug}'
                path = FIXTURES/f'{Path(source["path"]).stem}-{pin}-{profile}.luauc'
                assert not path.exists(), path
                command = [str(compiler), '--binary', f'-O{opt}', f'-g{debug}', str(FIXTURES/source['path'])]
                compiled = subprocess.run(command, capture_output=True, timeout=15)
                assert compiled.returncode == 0 and compiled.stdout and compiled.stdout[0] != 0, compiled.stderr
                path.write_bytes(compiled.stdout)
                manifest['inputs'].append({'path': path.name, 'source': source['path'], 'pin': pin, 'profile': profile,
                                           'sha256': sha(path), 'command': command})
(FIXTURES/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')

def run(row):
    folder = OUT/Path(row['path']).stem
    folder.mkdir()
    compiler, host = PINS[row['pin']][1:]
    commands = []
    def execute(command, name):
        command = list(map(str, command))
        p = subprocess.run(command, capture_output=True, timeout=20)
        (folder/(name+'.stdout')).write_bytes(p.stdout)
        (folder/(name+'.stderr')).write_bytes(p.stderr)
        commands.append({'command': command, 'exitCode': p.returncode, 'stdout': name+'.stdout', 'stderr': name+'.stderr'})
        return p
    original = execute([host, FIXTURES/row['path']], 'original')
    results = {}
    for name, dist in ENGINES.items():
        recovered = execute([NODE, dist/'cli.js', 'decompile', FIXTURES/row['path']], name+'-decompile')
        (folder/(name+'.luau')).write_bytes(recovered.stdout)
        compiled = execute([compiler, '--binary', '-O'+row['profile'][1], '-g'+row['profile'][3], folder/(name+'.luau')], name+'-compile')
        (folder/(name+'.luauc')).write_bytes(compiled.stdout)
        actual = execute([host, folder/(name+'.luauc')], name+'-actual')
        results[name] = {'decompileExit': recovered.returncode, 'compileExit': compiled.returncode, 'exitCode': actual.returncode,
                         'stdout': actual.stdout.decode(), 'stderr': actual.stderr.decode(), 'sourceSha256': sha(folder/(name+'.luau')),
                         'match': original.returncode == recovered.returncode == compiled.returncode == actual.returncode == 0 and
                         original.stdout == actual.stdout and original.stderr == actual.stderr}
    (folder/'commands.json').write_text(json.dumps(commands, indent=2)+'\n')
    return {'input': row['path'], 'pin': row['pin'], 'profile': row['profile'], 'original': {'exitCode': original.returncode,
            'stdout': original.stdout.decode(), 'stderr': original.stderr.decode()}, **results}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(run, manifest['inputs']))
summary = {'total': len(results), 'passed': {name: sum(row[name]['match'] for row in results) for name in ENGINES},
           'engines': {name: str(path) for name,path in ENGINES.items()}, 'node': NODE, 'pins': manifest['pins'], 'results': results}
(OUT/'summary.json').write_text(json.dumps(summary, indent=2)+'\n')
print(json.dumps({key: value for key,value in summary.items() if key != 'results'}, indent=2))
sys.exit(0 if all(row[name]['match'] for row in results for name in ENGINES) else 1)
