#!/usr/bin/env python3
"""Frozen-candidate validation; never infer a final candidate from mutable HEAD."""
import argparse
from collections import Counter
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT = Path('/workspace/scratch/eb5e4be57451')
REPO = ROOT / 'Luau-decompiler'
ROSETTA = ROOT / 'rosetta-research'
DONOR = ROOT / 'similarity-local-scopes'
ROSETTA_PIN = '80f3c13ce48dc3318d5d49f54958f580937ca8aa'
SUITE_SHA = '0b67b06dee91960755f9e5fbeadcd0722ec77e7d1a0b54878285b77af66ee142'
NODES = {
    'node20': Path('/home/agent/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin/node'),
    'node22': Path('/home/agent/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node'),
}
NODE_VERSIONS = {'node20': 'v20.20.2', 'node22': 'v22.23.5'}
EXPECTED = {
    'quick': (882, 882, 'e24826907050bd1d'),
    'full': (12276, 12282, 'f0eae8ffcedd440e'),
    'hard-quick': (882, 882, '9bcb49d29e867a92'),
    'hard-full': (12276, 12282, '9921d3bde4a99bfd'),
}
FORBIDDEN = ('ROSETTA_TRANSFORM_OFF', 'ROSETTA_TRANSFORM_ONLY', 'LUAU_DECOMPILE_OPTS')


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def tree_digest(cwd, entries):
    """Match scripts/bench-rosetta.mjs treeDigest byte for byte."""
    result = hashlib.sha256()

    def add(relative):
        path = cwd / relative
        if path.is_symlink():
            raise RuntimeError(f'Symlinked fingerprint input: {path}')
        if path.is_dir():
            for child in sorted(path.iterdir(), key=lambda item: item.name):
                add(relative + '/' + child.name)
        elif path.is_file():
            result.update(relative.encode())
            result.update(b'\0')
            result.update(digest(path).encode())
            result.update(b'\0')
        else:
            raise RuntimeError(f'Non-regular fingerprint input: {path}')

    for entry in sorted(entries):
        add(entry)
    return result.hexdigest()


def compiled_snapshot(cwd):
    return {
        'sourceTreeSha256': tree_digest(cwd, ['src', 'package.json', 'package-lock.json', *[path.name for path in cwd.glob('tsconfig*.json')]]),
        'distSha256': tree_digest(cwd, ['dist']),
    }


def output(command, cwd=None):
    return subprocess.check_output([str(x) for x in command], cwd=cwd, text=True).strip()


def git(cwd, *args):
    return output(['git', '-C', cwd, *args])


def save_new(path, value):
    with Path(path).open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')


def environment(node):
    env = os.environ.copy()
    for key in FORBIDDEN:
        if key in env:
            raise RuntimeError(f'Forbidden benchmark override is present: {key}')
    env['PATH'] = str(Path(node).parent) + os.pathsep + env['PATH']
    return env


def source_snapshot(cwd):
    files = sorted((cwd / 'src').rglob('*'))
    files += sorted(cwd.glob('tsconfig*.json'))
    files += [cwd / 'package.json', cwd / 'package-lock.json']
    hashes = {}
    for file in files:
        if file.is_symlink():
            raise RuntimeError(f'Symlinked source input: {file}')
        if file.is_file():
            hashes[str(file.relative_to(cwd))] = digest(file)
    return {
        'revision': git(cwd, 'rev-parse', 'HEAD'),
        'tree': git(cwd, 'rev-parse', 'HEAD^{tree}'),
        'status': git(cwd, 'status', '--porcelain=v1', '--untracked-files=normal'),
        'sourceSha256': hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest(),
        'files': hashes,
    }


def rosetta_snapshot():
    assert git(ROSETTA, 'rev-parse', 'HEAD') == ROSETTA_PIN, 'Wrong Rosetta revision'
    assert not git(ROSETTA, 'status', '--porcelain=v1', '--untracked-files=no'), 'Modified Rosetta tracked files'
    assert not git(ROSETTA, 'ls-files', '--others', '--', 'cases', 'libraries'), 'Extra Rosetta corpus inputs'
    return {
        'checkout': str(ROSETTA),
        'revision': ROSETTA_PIN,
        'tree': git(ROSETTA, 'rev-parse', 'HEAD^{tree}'),
        'binarySha256': digest(ROSETTA / 'target/release/rosetta'),
        'luau': '0.747',
    }


def prepare(args):
    assert re.fullmatch(r'[0-9a-f]{40}', args.revision), 'Supply the exact parent-approved 40-character final commit'
    assert re.fullmatch(r'[a-z0-9][a-z0-9-]+', args.label), 'Use a simple unique label'
    assert args.threads > 0
    environment(NODES['node22'])
    assert git(REPO, 'rev-parse', args.revision + '^{commit}') == args.revision
    suite_text = subprocess.check_output(['git', '-C', str(REPO), 'show', args.revision + ':benchmarks/rosetta/suite.json'])
    assert hashlib.sha256(suite_text).hexdigest() == SUITE_SHA, 'Pinned suite manifest changed'
    target_lock = subprocess.check_output(['git', '-C', str(REPO), 'show', args.revision + ':package-lock.json'])
    assert target_lock == (DONOR / 'package-lock.json').read_bytes(), 'Dependency donor lock differs'
    for name, node in NODES.items():
        assert output([node, '--version']) == NODE_VERSIONS[name], f'Wrong runtime {name}'
    destination = ROOT / 'measurements' / args.label
    paths = {key: ROOT / 'measurements' / f'{args.label}-{key}-engine' for key in [*EXPECTED, *NODES]}
    for path in [destination, *paths.values()]:
        assert not path.exists(), f'Refusing to replace an existing run: {path}'
    plan = {
        'format': 'annonyA-frozen-validation-plan', 'schema': 1, 'preparedAt': now(),
        'revision': args.revision, 'tree': git(REPO, 'rev-parse', args.revision + '^{tree}'),
        'output': str(destination), 'threadsPerTier': args.threads,
        'suiteManifestSha256': SUITE_SHA, 'rosetta': rosetta_snapshot(),
        'nodes': {name: {'executable': str(node), 'version': NODE_VERSIONS[name], 'sha256': digest(node)} for name, node in NODES.items()},
        'worktrees': {key: str(value) for key, value in paths.items()},
        'expected': {tier: {'usable': values[0], 'roundTrips': values[1], 'hash': values[2]} for tier, values in EXPECTED.items()},
        'engineOptions': 'default; no overrides',
        'gallery': {'enabled': True, 'reduction': False, 'reruns': False, 'upstreamPerSectionCap': 150, 'upstreamTextClipBytes': 16384},
        'recommendedScheduling': [['quick', 'hard-quick'], ['full', 'hard-full']],
        'dependencyDonor': str(DONOR), 'dependencyLockSha256': hashlib.sha256(target_lock).hexdigest(),
    }
    destination.mkdir()
    save_new(destination / 'plan.json', plan)
    with (destination / 'prepare.log').open('x') as log:
        for name, path in paths.items():
            for command in [
                ['git', '-C', str(REPO), 'worktree', 'add', '--detach', str(path), args.revision],
                ['cp', '-al', str(DONOR / 'node_modules'), str(path / 'node_modules')],
            ]:
                log.write(json.dumps(command) + '\n'); log.flush()
                subprocess.run(command, check=True, stdout=log, stderr=subprocess.STDOUT)
            snap = source_snapshot(path)
            assert snap['revision'] == args.revision and not snap['status'], f'Unclean snapshot {name}'
            save_new(destination / (name + '-source-before.json'), snap)
    print(destination / 'plan.json', flush=True)


def load_plan(path, key):
    plan = json.loads(Path(path).read_text())
    assert plan['format'] == 'annonyA-frozen-validation-plan'
    cwd = Path(plan['worktrees'][key])
    assert git(cwd, 'rev-parse', 'HEAD') == plan['revision']
    assert not git(cwd, 'status', '--porcelain=v1', '--untracked-files=normal'), 'Engine snapshot is dirty'
    assert digest(cwd / 'benchmarks/rosetta/suite.json') == SUITE_SHA
    assert rosetta_snapshot() == plan['rosetta'], 'Rosetta changed since plan was sealed'
    return plan, cwd


def run_logged(cwd, node, command, log_path, revision):
    start = time.monotonic()
    with Path(log_path).open('x') as log:
        log.write(json.dumps({'revision': revision, 'node': str(node), 'command': command, 'startedAt': now()}) + '\n')
        log.flush()
        process = subprocess.run(command, cwd=cwd, env=environment(node), stdout=log, stderr=subprocess.STDOUT)
    return {'command': command, 'exitCode': process.returncode, 'seconds': round(time.monotonic() - start, 3), 'log': str(log_path)}


def run_tier(args):
    plan, cwd = load_plan(args.plan, args.tier)
    node = Path(plan['nodes']['node22']['executable'])
    assert output([node, '--version']) == plan['nodes']['node22']['version']
    assert digest(node) == plan['nodes']['node22']['sha256']
    out = Path(plan['output']) / args.tier
    out.mkdir()
    save_new(out / 'source-before.json', source_snapshot(cwd))
    command = [str(node), str(cwd / 'scripts/bench-rosetta.mjs'), '--rosetta-dir', str(ROSETTA), '--tier', args.tier, '--out', str(out), '--threads', str(plan['threadsPerTier']), '--gallery']
    record = {'tier': args.tier, 'revision': plan['revision'], 'startedAt': now(), 'gate': 'all-pass', 'issues': []}
    record['process'] = run_logged(cwd, node, command, out / 'run.log', plan['revision'])
    result_path = out / f'annonyA-{args.tier}.json'
    validation = [str(node), str(cwd / 'scripts/rosetta/validate.mjs'), str(result_path), '--tier', args.tier, '--expected-version', plan['revision']]
    record['strictValidation'] = run_logged(cwd, node, validation, out / 'strict-validation.log', plan['revision'])
    try:
        result = json.loads(result_path.read_text())
        expected = plan['expected'][args.tier]
        counts = Counter(letter for section in result['sections'] for test in section['tests'] for letter in test['results'])
        record['score'] = result['score']
        record['quality'] = result.get('quality')
        record['recount'] = dict(counts)
        record['firstFailures'] = [
            {'section': section['id'], 'test': test['name'], 'profile': result['profiles'][index], 'verdict': result['letters'][letter], 'detail': test.get('details', {}).get(result['profiles'][index])}
            for section in result['sections'] for test in section['tests'] for index, letter in enumerate(test['results']) if letter not in ('p', 'u')
        ]
        if result['score'] != {'passed': expected['usable'], 'total': expected['usable']}:
            record['issues'].append('Score does not pass every expected usable round trip')
        if sum(counts.values()) != expected['roundTrips'] or counts['p'] != expected['usable'] or counts['u'] != expected['roundTrips'] - expected['usable']:
            record['issues'].append('Independent verdict recount does not match the pinned tier')
        if result.get('quality', {}).get('round_trips') != expected['usable']:
            record['issues'].append('Quality coverage does not match all usable passes')
        provenance = json.loads((out / f'annonyA-{args.tier}.provenance.json').read_text())
        if provenance['status'] != 'completed' or provenance['gate'] != 'all-pass' or provenance['runtime']['node'] != plan['nodes']['node22']['version']:
            record['issues'].append('Provenance is incomplete, non-strict, or has the wrong runtime')
        if provenance['engine']['revision'] != plan['revision'] or provenance['engine']['dirty']:
            record['issues'].append('Provenance engine revision/status differs from the frozen candidate')
    except Exception as error:
        record['issues'].append(f'Unable to verify complete evidence: {error}')
    before = json.loads((out / 'source-before.json').read_text())
    after = source_snapshot(cwd)
    save_new(out / 'source-after.json', after)
    if before != after or rosetta_snapshot() != plan['rosetta']:
        record['issues'].append('Source or pinned harness changed during execution')
    record['finishedAt'] = now()
    if (cwd / 'dist').is_dir():
        record['compiled'] = compiled_snapshot(cwd)
    else:
        record['issues'].append('Engine build did not produce dist')
    record['passed'] = record['process']['exitCode'] == 0 and record['strictValidation']['exitCode'] == 0 and not record['issues']
    record['filesSha256'] = {path.name: digest(path) for path in sorted(out.iterdir()) if path.is_file()}
    save_new(out / 'summary.json', record)
    print(json.dumps(record), flush=True)
    return 0 if record['passed'] else 1


def run_validation(args):
    plan, cwd = load_plan(args.plan, args.runtime)
    runtime = plan['nodes'][args.runtime]
    node = Path(runtime['executable'])
    assert output([node, '--version']) == runtime['version'] and digest(node) == runtime['sha256']
    out = Path(plan['output']) / args.runtime
    out.mkdir()
    before = source_snapshot(cwd)
    summary = {'revision': plan['revision'], 'runtime': runtime, 'startedAt': now(), 'gates': [], 'notRun': []}
    save_new(out / 'source-before.json', before)
    commands = [
        ('build', ['npm', 'run', 'build']),
        ('typecheck', ['npm', 'run', 'typecheck']),
        ('unit', ['npm', 'test', '--', '--maxWorkers=2']),
        ('bench-test', ['npm', 'run', 'bench:test']),
        ('bench-smoke', ['npm', 'run', 'bench:compare', '--', '--output', str(out / 'baseline.json')]),
        ('build-demo', ['npm', 'run', 'build:demo']),
        ('demo-test', ['npm', 'run', 'demo:test']),
    ]
    for key, command in commands:
        item = {'gate': key, **run_logged(cwd, node, command, out / (key + '.log'), plan['revision'])}
        text = Path(item['log']).read_text()
        item['passed'] = item['exitCode'] == 0
        if key == 'unit':
            matches = [re.search(r'\bTests\s+(\d+) passed', text), re.search(r'\bTest Files\s+(\d+) passed', text)]
            item['testsPassed'] = int(matches[0].group(1)) if matches[0] else None
            item['testFilesPassed'] = int(matches[1].group(1)) if matches[1] else None
            item['passed'] &= all(match and int(match.group(1)) > 0 for match in matches)
        if key in ('bench-test', 'demo-test'):
            for field, pattern in [('testsPassed', 'pass'), ('testsFailed', 'fail'), ('testsSkipped', 'skipped')]:
                match = re.search(r'^# ' + pattern + r' (\d+)$', text, re.M)
                item[field] = int(match.group(1)) if match else None
            item['passed'] &= bool(item['testsPassed']) and item['testsFailed'] == 0 and item['testsSkipped'] == 0
        if key == 'bench-smoke':
            try:
                report = json.loads((out / 'baseline.json').read_text())
                item['fixtureCounts'] = report['fixtureCounts']
                item['syntaxAndSemantics'] = 'Smoke only; official parser and runtime are separate gates.'
                item['passed'] &= report['fixtureCounts']['total'] > 0 and report['fixtureCounts']['successful'] == report['fixtureCounts']['total']
            except Exception as error:
                item['passed'] = False
                item['verificationError'] = str(error)
        summary['gates'].append(item)
        print(json.dumps(item), flush=True)
        if key == 'build' and not item['passed']:
            summary['notRun'].extend({'gate': name, 'reason': 'Initial build failed'} for name, _ in commands[1:])
            break
    summary['notRun'].extend([
        {'gate': 'real-browser-demo', 'reason': 'The known /usr/bin/chromium launcher has no /usr/lib/chromium/chromium binary. No browser result is claimed; exact-head remote CI remains required.'},
        {'gate': 'official-pinned-Luau-and-public-corpora', 'reason': 'Local reference checkouts have different revisions from CI; no substitution. Exact-head remote CI remains required.'},
    ])
    after = source_snapshot(cwd)
    save_new(out / 'source-after.json', after)
    summary['unchangedSource'] = before == after
    if (cwd / 'dist').is_dir():
        summary['compiled'] = compiled_snapshot(cwd)
    summary['allExecutedGatesPassed'] = len(summary['gates']) == len(commands) and summary['unchangedSource'] and all(x['passed'] for x in summary['gates'])
    summary['finishedAt'] = now()
    summary['filesSha256'] = {path.name: digest(path) for path in sorted(out.iterdir()) if path.is_file()}
    save_new(out / 'summary.json', summary)
    print(json.dumps(summary), flush=True)
    return 0 if summary['allExecutedGatesPassed'] else 1


def summarize(args):
    plan = json.loads(Path(args.plan).read_text())
    out = Path(plan['output'])
    summary = {'revision': plan['revision'], 'tree': plan['tree'], 'createdAt': now(), 'tiers': {}, 'runtimes': {}, 'issues': []}
    identities = []
    for tier in EXPECTED:
        try:
            record = json.loads((out / tier / 'summary.json').read_text())
            provenance = json.loads((out / tier / f'annonyA-{tier}.provenance.json').read_text())
            engine = provenance['engine']
            identity = {key: engine[key] for key in ['revision', 'commitTree', 'sourceTreeSha256', 'distSha256']}
            identities.append(identity)
            if record['compiled'] != {key: identity[key] for key in ['sourceTreeSha256', 'distSha256']}:
                summary['issues'].append(f'{tier}: final compiled snapshot differs from wrapper provenance')
            summary['tiers'][tier] = {key: record.get(key) for key in ['passed', 'score', 'quality', 'issues', 'firstFailures']}
            summary['tiers'][tier]['identity'] = identity
            summary['tiers'][tier]['summarySha256'] = digest(out / tier / 'summary.json')
            if not record['passed']:
                summary['issues'].append(f'{tier}: strict validation failed')
        except Exception as error:
            summary['issues'].append(f'{tier}: incomplete evidence: {error}')
    for runtime in NODES:
        try:
            record = json.loads((out / runtime / 'summary.json').read_text())
            source = json.loads((out / runtime / 'source-after.json').read_text())
            identity = {'revision': source['revision'], 'commitTree': source['tree'], **record['compiled']}
            identities.append(identity)
            summary['runtimes'][runtime] = {key: record.get(key) for key in ['allExecutedGatesPassed', 'runtime', 'gates', 'notRun']}
            summary['runtimes'][runtime]['identity'] = identity
            summary['runtimes'][runtime]['summarySha256'] = digest(out / runtime / 'summary.json')
            if not record['allExecutedGatesPassed']:
                summary['issues'].append(f'{runtime}: one or more executed gates failed')
        except Exception as error:
            summary['issues'].append(f'{runtime}: incomplete evidence: {error}')
    summary['identicalEngineAcrossSixSnapshots'] = len(identities) == 6 and all(item == identities[0] for item in identities)
    if not summary['identicalEngineAcrossSixSnapshots']:
        summary['issues'].append('Source/dist/revision/tree identity is not established across all six snapshots')
    if any(item['revision'] != plan['revision'] or item['commitTree'] != plan['tree'] for item in identities):
        summary['issues'].append('An engine identity differs from the parent-approved commit/tree')
    summary['allLocalGatesPassed'] = not summary['issues']
    summary['remotePublicationEquivalence'] = {'status': 'pending', 'expectedCommit': plan['revision'], 'expectedCommitTree': plan['tree'], 'reason': 'Compare the published remote commit tree and exact-head CI separately; this local report does not publish or infer a remote result.'}
    save_new(out / 'summary.json', summary)
    print(json.dumps(summary), flush=True)
    return 0 if summary['allLocalGatesPassed'] else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    create = sub.add_parser('prepare')
    create.add_argument('--revision', required=True)
    create.add_argument('--label', required=True)
    create.add_argument('--threads', type=int, default=4)
    tier = sub.add_parser('tier')
    tier.add_argument('--plan', required=True)
    tier.add_argument('--tier', choices=EXPECTED, required=True)
    validation = sub.add_parser('validation')
    validation.add_argument('--plan', required=True)
    validation.add_argument('--runtime', choices=NODES, required=True)
    aggregate = sub.add_parser('summarize')
    aggregate.add_argument('--plan', required=True)
    args = parser.parse_args()
    return {'prepare': prepare, 'tier': run_tier, 'validation': run_validation, 'summarize': summarize}[args.command](args) or 0


if __name__ == '__main__':
    sys.exit(main())
