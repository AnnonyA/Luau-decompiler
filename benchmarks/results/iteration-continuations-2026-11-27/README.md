# Shared continuations within an iteration

The change recovers one shared continuation when an exit-based post-dominator
belongs to a later iteration. It retains existing SSA owners and requires an
acyclic prefix with no capture/close, new phi, live-in write, nested iteration,
frame/pack producer, allocation or store. The
[design and pinned references](../../../docs/references/iteration-continuations.md)
describe the proof and its deliberate exclusions.

## Strict measurements

These reports measure `12bd5f0cee55aabb9d3c779cc11054b2312486f0` plus the
uncommitted continuation change. The dirty state is explicit in both provenance
files; the actual source and build hashes identify the measured engine. This
base includes other integrated similarity improvements, so the global score
must not be attributed entirely to this one change.

| Tier | Passed / usable | Mismatch | Recompile / decompile / refused | Similarity | Token size ratio |
|---|---:|---:|---:|---:|---:|
| Quick | 882 / 882 | 0 | 0 / 0 / 0 | 77.279995% | 0.986102 |
| Hard Quick | 882 / 882 | 0 | 0 / 0 / 0 | 76.674644% | 0.991562 |

Both tiers have zero unusable inputs and cover cases 246/246, libraries 36/36,
generated 300/300 and mutants 300/300. Both ran as strict all-pass gates under
Node 22.23.5, with default engine options and the unchanged pinned Rosetta
suite. No Full or Hard Full run is claimed for this isolated change.

- Actual engine source SHA-256: `f9f6540b5b3716b6f13a340de1a005e768a85db02e8e7fd920afed005818c0fe`.
- Full `dist` SHA-256: `fbe287f290ca7252e1c2998a54aa11073746fe590057b6eb485ad0a3b274a9bf`.
- Diagnostic JavaScript-only tree SHA-256: `615365476b7eafc085382b8463ab84d1364765a209f7069b67c37300706a9cb8`.
- Rosetta revision: `80f3c13ce48dc3318d5d49f54958f580937ca8aa`.
- Quick suite hash: `e24826907050bd1d`; Hard Quick: `9bcb49d29e867a92`.

The raw [Quick report](annonyA-quick.json) and
[provenance](annonyA-quick.provenance.json), and the raw
[Hard Quick report](annonyA-hard-quick.json) and
[provenance](annonyA-hard-quick.provenance.json), preserve every outcome and
the exact commands. Timing is recorded as evidence, without a speed claim.

## Focal result and independent controls

The [12-profile comparison](targeted-comparison.json) uses the actual integrated
12bd engine as its before state: mean similarity improves from 73.681727% to
81.825316%. Manual `calculator` is unchanged. `mut1-929` O0/O1 reduce duplicate
continuation copies and improve from about 60% to 84–85%; its O2 variants are
unchanged because their terminal path contains `CLOSEUPVALS`, outside the
proof. The [official round-trip check](targeted-check.json) passes all 12.
This targeted development set does not establish a general quality delta.

Five [project-authored sources and bytecodes](../../../tests/fixtures/iteration-continuations/manifest.json)
cover early return, effect order, nil-containing fixed tuples, fresh mutable
captured cells in the shared continuation, previously captured cells and
saved aliases across reassignment, and nested loops with captures. The two
official compiler/VM revisions are `c87565b8` and `9d7748a4`, each tested at
O0/O1/O2 and g1/g2.

- [First 24 observations](first-authored-baseline.json) remain byte-for-byte
  unchanged. That first report has a stale descriptive purpose label from the
  reused observer; its source hashes and results identify the actual controls.
- [Expanded baseline](authored-baseline.json) and
  [candidate](authored-candidate.json): 48/48 each.
- [Shared-closure baseline](closure-tail-baseline.json) and
  [candidate](closure-tail-candidate.json): 12/12 each.
- [Source structure comparison](authored-structure.json): the two admitted
  programs have one shared-effect occurrence instead of three in all 24
  profiles. The other 36 profiles have byte-identical reconstructed source.
- [Focused unit log](unit-focused.log): 148/148 tests in six files, including
  explicit rejection tests for cycles, nested regions, phis, live-in writes,
  consumed blocks, non-return exits and unsafe instruction classes.

The immutable reports preserve original and reconstructed stdout, exit status,
compiler errors and source/bytecode hashes. These sources and focal Rosetta
inputs are now development regressions. An independent review checked the
continuation helper and its interactions with branch emission, register
environments and alias snapshots, and found no further concrete blocker in
the supported scope.

## Reproduction

From the project root, with the unchanged pinned Rosetta checkout:

```sh
npm run build
npm exec vitest run tests/iteration-continuations.test.ts tests/rosetta-shared-continuation.test.ts tests/shared-return-conditions.test.ts tests/terminal-loop-boundaries.test.ts tests/terminal-return-adapters.test.ts tests/cfg-ssa.test.ts
npm run bench:rosetta -- --rosetta-dir /path/to/rosetta --tier quick --out /new/quick --threads 4
npm run bench:rosetta -- --rosetta-dir /path/to/rosetta --tier hard-quick --out /new/hard-quick --threads 4
```

For each authored profile, compile its source with the recorded official
revision and `luau-compile --binary -O0 -g1` (substituting its profile), decompile
that bytecode, and recompile the result with the same options. Execute both
bytecodes with `scripts/closure-identity/run_bytecode.cpp` linked to that same
revision's VM and compare complete stdout, stderr and exit code. The fixture
manifest supplies the original source and bytecode hashes. No benchmark
overrides or source substitution are used.
