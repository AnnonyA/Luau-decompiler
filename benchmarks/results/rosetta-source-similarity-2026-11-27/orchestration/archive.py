#!/usr/bin/env python3
"""Archive completed final measurements without replacing existing evidence."""
from pathlib import Path
import datetime
import hashlib
import json

ROOT = Path('/workspace/scratch/eb5e4be57451')
SOURCE = ROOT / 'measurements/similarity-final-01'
DESTINATION = ROOT / 'Luau-decompiler/benchmarks/results/rosetta-source-similarity-2026-11-27'
TIERS = ['quick', 'full', 'hard-quick', 'hard-full']
RUNTIMES = ['node20', 'node22']


def digest(content):
    return hashlib.sha256(content).hexdigest()


def main():
    plan = json.loads((SOURCE / 'plan.json').read_text())
    local_bytes = (SOURCE / 'summary.json').read_bytes()
    local = json.loads(local_bytes)
    mapping_bytes = (DESTINATION / 'engine-mapping.json').read_bytes()
    receipt_bytes = (DESTINATION / 'publication-receipt.json').read_bytes()
    mapping = json.loads(mapping_bytes)
    receipt = json.loads(receipt_bytes)
    assert mapping['localCommit'] == receipt['sourceCommit'] == plan['revision'] == local['revision']
    assert mapping['publishedCommit'] == receipt['remoteCommit']
    assert mapping['tree'] == receipt['sourceTree'] == plan['tree'] == local['tree']
    assert receipt['treeVerified'] is True
    for identity in [value['identity'] for value in [*local['tiers'].values(), *local['runtimes'].values()]]:
        assert identity['revision'] == plan['revision']
        assert identity['commitTree'] == plan['tree']
        for field in ['sourceTreeSha256', 'distSha256']:
            assert identity[field] == mapping[field] == receipt[field]

    copies = {}
    def add(source, relative):
        assert source.is_file() and not source.is_symlink(), f'Missing/non-regular evidence: {source}'
        assert relative not in copies
        assert not (DESTINATION / relative).exists(), f'Refusing to overwrite: {relative}'
        copies[relative] = source

    for tier in TIERS:
        for suffix in ['.json', '.provenance.json', '.gallery.json']:
            name = f'annonyA-{tier}{suffix}'
            add(SOURCE / tier / name, name)
        for source in sorted((SOURCE / tier).iterdir()):
            if source.is_file() and not source.name.startswith('annonyA-'):
                add(source, f'runs/{tier}/{source.name}')
    add(SOURCE / 'plan.json', 'plan.json')
    add(SOURCE / 'prepare.log', 'orchestration/prepare.log')
    add(SOURCE / 'summary.json', 'orchestration/local-summary.json')
    for source in sorted((SOURCE / 'orchestration').iterdir()):
        if source.is_file():
            add(source, f'orchestration/{source.name}')
    for source in sorted(SOURCE.glob('*-source-before.json')):
        add(source, f'orchestration/initial-snapshots/{source.name}')
    for runtime in RUNTIMES:
        for source in sorted((SOURCE / runtime).iterdir()):
            if source.is_file():
                add(source, f'validation/local/{runtime}/{source.name}')
    add(Path(__file__).resolve(), 'orchestration/archive.py')
    assert not (DESTINATION / 'summary.json').exists()
    assert not (SOURCE / 'archive-receipt.json').exists()

    local['remotePublicationEquivalence'] = {
        'status': 'verified-tree-and-engine-digests',
        'localCommit': plan['revision'],
        'publishedCommit': mapping['publishedCommit'],
        'commitTree': plan['tree'],
        'sourceTreeSha256': mapping['sourceTreeSha256'],
        'distSha256': mapping['distSha256'],
        'verificationSource': 'Parent GitHub API verification recorded in the preserved publication receipt, checked against all six local snapshot identities.',
        'engineMapping': {'path': 'engine-mapping.json', 'sha256': digest(mapping_bytes)},
        'publicationReceipt': {'path': 'publication-receipt.json', 'sha256': digest(receipt_bytes)},
        'ciScope': 'Tree equivalence does not claim remote CI completion; preserve and consult the separate exact-head CI evidence.',
    }
    local['originalLocalSummary'] = {'path': 'orchestration/local-summary.json', 'sha256': digest(local_bytes)}
    local['archivedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    archived = {}
    for relative, source in copies.items():
        destination = DESTINATION / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        content = source.read_bytes()
        with destination.open('xb') as stream:
            stream.write(content)
        assert destination.read_bytes() == content
        archived[relative] = {'bytes': len(content), 'sha256': digest(content)}
    with (DESTINATION / 'summary.json').open('x') as stream:
        json.dump(local, stream, indent=2)
        stream.write('\n')
    assert (DESTINATION / 'engine-mapping.json').read_bytes() == mapping_bytes
    assert (DESTINATION / 'publication-receipt.json').read_bytes() == receipt_bytes
    with (SOURCE / 'archive-receipt.json').open('x') as stream:
        json.dump({'destination': str(DESTINATION), 'files': archived, 'consolidatedSummarySha256': digest((DESTINATION / 'summary.json').read_bytes()), 'parentFilesUnchanged': True}, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'destination': str(DESTINATION), 'copiedFiles': len(copies), 'allLocalGatesPassed': local['allLocalGatesPassed'], 'remoteCommit': mapping['publishedCommit']}))


if __name__ == '__main__':
    main()
