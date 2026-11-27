#!/usr/bin/env python3
"""Render the release note from completed, unmodified strict result files."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--repo', type=Path, required=True)
args = parser.parse_args()
repo = args.repo.resolve()
destination = repo / 'benchmarks/results/rosetta-source-similarity-2026-11-27'
baseline = repo / 'benchmarks/results/rosetta-final-2026-11-27'
mapping = json.loads((destination / 'engine-mapping.json').read_text())
tiers = [('quick', 'Quick', 882, 0), ('full', 'Full', 12276, 6),
         ('hard-quick', 'Hard Quick', 882, 0), ('hard-full', 'Hard Full', 12276, 6)]
metrics = []
readme_metrics = []
verdicts = []
inventories = []
for tier, label, expected, unusable in tiers:
    current = json.loads((destination / f'annonyA-{tier}.json').read_text())
    previous = json.loads((baseline / f'annonyA-{tier}.json').read_text())
    assert current['decompiler']['version'] == mapping['localCommit']
    assert current['score'] == {'passed': expected, 'total': expected}
    assert current['totals'] == ({'pass': expected, 'unusable': unusable} if unusable else {'pass': expected})
    assert current['quality']['round_trips'] == expected
    assert current['suite'] == previous['suite']
    quality, old = current['quality'], previous['quality']
    metrics.append(f'| {label} | [{expected:,}/{expected:,}](annonyA-{tier}.json) | '
                   f'{old["similarity"]:.6f}% | **{quality["similarity"]:.6f}%** | '
                   f'{quality["similarity"] - old["similarity"]:+.6f} pp | '
                   f'{old["size"]:.6f} | **{quality["size"]:.6f}** |')
    readme_metrics.append(f'| {label} | {expected:,}/{expected:,} | {old["similarity"]:.2f}% | '
                          f'**{quality["similarity"]:.2f}%** | {quality["size"] * 100:.2f}% |')
    verdicts.append(f'| {label} | {expected:,} | 0 | 0 | 0 | 0 | {unusable} |')
    inventories.append(f'| {label} | `{current["suite"]["hash"]}` | {expected + unusable:,} | {expected:,} |')

text = f'''# Rosetta source-similarity results — 2026-11-27

**All four strict behavioral gates pass every usable source/profile pair.**
The integrated engine improves source similarity and reduces reconstruction
scaffolding. **The requested 82.2%, 90%, and 100% similarity targets are not
achieved.** Behavioral success and source similarity are reported separately.

Every new row below uses local engine `{mapping['localCommit']}`, published as
[`{mapping['publishedCommit']}`](https://github.com/AnnonyA/Luau-decompiler/commit/{mapping['publishedCommit']}).
Their complete Git trees are identical. [Engine mapping](engine-mapping.json)

## Measured similarity and output size

The baseline is the previously completed engine published as
[`08259cd6`](https://github.com/AnnonyA/Luau-decompiler/commit/08259cd6c312fe9c41eda0e0c5d0d03d9524cf71),
with its [original four raw reports](../rosetta-final-2026-11-27/README.md)
retained unchanged. These are new strict executions, not rescored intermediate
outputs or results assembled from different engine revisions.

| Tier | New behavioral pass | Previous similarity | New similarity | Change | Previous token ratio | New token ratio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
{chr(10).join(metrics)}

Similarity is the arithmetic mean of Rosetta's normalized-token comparison over
passing source/profile pairs. The lexer ignores whitespace/comments and
normalizes names, numbers, and strings. Operators, keywords and source structure
still matter. Renaming and indentation alone do not improve this metric.

The token ratio is the geometric mean of
`(output_tokens + 1) / (source_tokens + 1)`. **1.0 means equal token size in that
aggregate, not identical bytes or equal length for every program.** This report
does not claim a byte-size or speed ranking. The upstream two-second Myers
deadline remains unchanged; its bounded computation can introduce timing
variation on unusually large diffs. Original measurements are never replaced
by a later, more favorable rescore.

Quick and Hard Quick move close to a token ratio of 1.0. Full and Hard Full
instead become shorter than their originals (about 87.55% and 87.72% of source
tokens), farther below 1.0 than the previous baseline. Output-size closeness
therefore does **not** improve uniformly across tiers. Removing reconstruction
scaffolding cannot recreate syntax that the compiler erased.

[Exact metric](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/src/quality.rs)
· [Lexer](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/src/lex.rs)
· [Machine-readable comparison](comparison.json)

## Complete behavioral accounting

| Tier | Pass | Mismatch | Recompile failed | Decompile failed | Refused | Unusable original |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
{chr(10).join(verdicts)}

Full and Hard Full each schedule 12,282 pairs. The six profiles of the upstream
original `generated/seed1541` exceed the existing execution step budget before
a usable reference result is produced. They remain `unusable` with their
original error details and are not counted as passing decompilations. The
strict validator requires those exact six identities. No candidate failure
is excluded or relabeled. Quick and Hard Quick have no unusable originals.

| Tier | Suite hash | Scheduled pairs | Graded pairs |
| --- | --- | ---: | ---: |
{chr(10).join(inventories)}

Quick has 41 manual cases, six libraries, 50 generated sources and 50 mutants,
each under six profiles. Full expands the latter two groups to 1,000 each.
Quick is a subset of Full. Hard tiers apply the pinned transformations to the
same source families; these counts are profile executions, not independent
unseen programs. The unchanged
[suite manifest](../../rosetta/suite.json) records every selection and profile.

## Comparison with published decompilers

[The comparison table](comparison.md) includes Luacid and lua.expert's published
pass counts, global quality, report dates, corpus identities and hashes.
No fresh request to either live service is represented by those snapshots.

Rosetta computes each engine's quality only on its passing population. Our
Quick result and lua.expert's published Quick result both cover all 882 pairs,
so those two global means are directly comparable. The other peer results
have different passing populations. The pinned JSON format does not expose
per-pair quality, so a new quality mean on the exact passing intersection
cannot be recovered from their aggregate. The report preserves this limitation
instead of inventing an intersection score. No claim of best source similarity
or universal superiority is made.

The comparison retains the existing finite-corpus coverage advantage: every
usable pair passes in our four tiers; the published Luacid reports have fewer
passes in all four, while lua.expert ties Quick and has fewer passes in the
other three. Those are behavioral coverage statements, separate from quality.

## Engine changes

The [engineering report](../../../docs/references/rosetta-source-similarity-2026-11-27.md)
explains the reconstruction proofs and pinned Tovek/Luau references:

- Smaller preserved-call boundaries and direct known variadic calls.
- Constant string fields without inventing anonymous function debug names.
- Shared terminal continuations, defined phis and closure closing.
- Recovered loop conditions and private primitive loop-result defaults.
- Prototype-aware temporary provenance and safe scalar expression-list folding.
- Redundant adjustment-parenthesis removal and corrected iterator result arity.
- Returning guard ladders, equality complements and private logical returns.

The new authored controls also expose and repair pre-existing errors in
anonymous function names, scalar iterator state, and an unused field read's
effects. Their original failures, source, bytecode, and later observations are
retained with each change. These repaired examples are development regressions,
not blind holdouts. No case-name rule or original-source lookup enters the
engine.

## Identity, execution and validation

| Item | Frozen value |
| --- | --- |
| Local source commit | `{mapping['localCommit']}` |
| Published source commit | `{mapping['publishedCommit']}` |
| Identical full Git tree | `{mapping['tree']}` |
| Source SHA-256 | `{mapping['sourceTreeSha256']}` |
| Distribution SHA-256 | `{mapping['distSha256']}` |
| Rosetta pin | `80f3c13ce48dc3318d5d49f54958f580937ca8aa` |
| Suite / compiler / transforms | rosetta-3 / Luau 0.747 / transform-2 |
| Measurement runtime | Node v22.23.5, Linux x64 |

Four clean tier worktrees and two separate Node validation worktrees use the
same revision and source. Quick and Hard Quick ran together, then Full and
Hard Full; each tier used four Rosetta workers. Unrelated unit/demo validation
was deferred until both full tiers completed. Direct CLI execution includes
Node startup. The previous baseline used Node v24.22.3; measured durations are
preserved for audit and are not used to infer a speed improvement.

Every `.provenance.json` preserves exact commands, hashes, runtime, clean
working-tree state and process outcome. `runs/` retains the original logs,
source fingerprints, independent recounts and strict validation. The runner
and validator are unchanged. They reject environment overrides, changed
corpora, unexpected inventories/profiles, changed source/build inputs and
incorrect counts. `--measure-only` was not used. A zero process exit or a
rounded 100% display cannot replace the all-pass checks.

The unchanged upstream galleries retain first outcomes without reduction or
reruns. Their format limits entries to 150 per section and clips source/output
text at 16 KiB. Raw reports retain every verdict and detail; the gallery is
not described as an unlimited byte archive.

[Local validation records](validation/local) cover Node 20.20.2 and 22.23.5:
build, typecheck, 1,540 unit tests in 145 files, 69 harness tests, smoke fixtures,
demo build and six demo tests for each runtime. No skipped gate is
counted as a pass. Local Chromium is unavailable; the real browser is checked
by GitHub CI.

[Exact engine-head CI evidence](validation/remote-ci/engine-f9543bbb/summary.md)
records Node 20/22, the official pinned parser/runtime and public corpora,
demo 6/6, real Chromium 1/1, and strict Quick/Hard Quick 882/882. The synthetic
PR test merge has the same tree as the published engine. A synthetic test merge
is not a merge into main. The historical 850 checkpoint and its transient
external HTTP 403/retry are stored separately and are not counted as failures
or successes of this final source.

The [publication receipt](publication-receipt.json) records the time when Full
and Hard Full were still pending. It is retained unchanged. The final raw
reports determine the later measured result. Later documentation commits
require their own fresh CI before merge; these engine-head checks are not
relabeled as checks of another head. Pages deployment is separately verified
after merge.

## Reproduce and inspect

Check out the published engine commit above, use Node 22.23.5 and the pinned
Rust toolchain used by the repository's Rosetta workflow, then run:

```sh
npm ci
git clone https://github.com/Scrensayol/rosetta.git /tmp/rosetta-3
git -C /tmp/rosetta-3 checkout --detach 80f3c13ce48dc3318d5d49f54958f580937ca8aa
cargo +1.100.0 build --release --locked --manifest-path /tmp/rosetta-3/Cargo.toml
for tier in quick full hard-quick hard-full; do
  npm run bench:rosetta -- --rosetta-dir /tmp/rosetta-3 \\
    --tier "$tier" --out "$PWD/tmp/source-similarity/$tier" --threads 4 --gallery
done
```

Each wrapper run rebuilds the measured distribution. Absolute original
commands and the six-worktree orchestrator are archived beside the reports.
The final evidence hashes can be checked with:

```sh
cd benchmarks/results/rosetta-source-similarity-2026-11-27
sha256sum --check SHA256SUMS
```

## Remaining target

The improvement is measured; the requested 82.2%/90% goal remains open.
[Authored bytecode-collision controls](../source-recoverability-2026-11-27/README.md)
show why exact normalized-source recovery cannot be guaranteed for arbitrary
bytecode. This is not an upper bound on this finite corpus or a proof that
82.2% or 90% is unreachable.

The [remaining helper-region investigation](../../../docs/references/remaining-inline-recovery.md)
identifies a substantial family of O2-expanded helpers whose recovery would
need additional matching and safety proofs. Its intermediate diagnostic
numbers are not a new candidate score or a promised gain. The present finite
corpus results do not prove correctness for every program, future compiler,
runtime environment or obfuscation strategy.
'''
target = destination / 'README.md'
with target.open('x') as stream:
    stream.write(text)
print(target)

main = repo / 'README.md'
original = main.read_text()
start = original.index('## Rosetta 3 reconstruction results')
end = original.index('## Quick start', start)
old_section = original[start:end]
table_start = old_section.index('| Tier | AnnonyA |')
table_end = old_section.index('\n\n', table_start)
coverage = old_section[table_start:table_end].replace(
    'benchmarks/results/rosetta-final-2026-11-27/annonyA-',
    'benchmarks/results/rosetta-source-similarity-2026-11-27/annonyA-')
assert len(coverage.splitlines()) == 6
section = f'''## Rosetta 3 reconstruction results

**Complete measured behavioral coverage:** Quick **882/882**; Full
**12,276/12,276**; Hard Quick **882/882**; Hard Full **12,276/12,276**.
All four strict gates use the same frozen engine, published as
[`{mapping['publishedCommit'][:8]}`](https://github.com/AnnonyA/Luau-decompiler/commit/{mapping['publishedCommit']}).

The source-similarity improvements shorten call wrappers and remove unnecessary
temporaries, duplicated continuations and loop scaffolding while preserving
observed behavior. **The 82.2% and 90% source-similarity targets remain unmet.**

| Tier | Behavioral pass | Previous similarity | New similarity | Output/original tokens |
| --- | ---: | ---: | ---: | ---: |
{chr(10).join(readme_metrics)}

Similarity uses Rosetta's normalized source tokens. Output size is its geometric
token ratio, **not bytes or a claim of equal length for every program**.
The full tiers produce about 88% of the original tokens, so closeness to the
original token size has not improved uniformly.
The [complete report and raw evidence](benchmarks/results/rosetta-source-similarity-2026-11-27/README.md)
include exact values, hashes, validation and the unchanged
[previous baseline](benchmarks/results/rosetta-final-2026-11-27/README.md).
[Engine changes and remaining source-recovery work](docs/references/rosetta-source-similarity-2026-11-27.md)
describe the bounded reconstruction proofs.

### Behavioral coverage against published snapshots

{coverage}

By behavioral pass coverage, this engine exceeds the published Luacid results
in all four tiers, ties lua.expert on Quick, and exceeds it on the other three.
Full and Hard Full each retain six unusable upstream original/profile pairs
outside their 12,276 graded pairs. These are finite-corpus development results,
not a guarantee for all Luau programs or a speed ranking.

Peer similarity averages can cover different passing populations; see the
[quality and coverage comparison](benchmarks/results/rosetta-source-similarity-2026-11-27/comparison.md).
No best-source-similarity claim is made. Quick and Hard Quick remain strict
automatic CI gates.

'''
main.write_text(original[:start] + section + original[end:])
print(main)
