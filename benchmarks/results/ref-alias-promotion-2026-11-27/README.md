# Preserve copies made before the first reference capture

The independently authored `rejected-state` control exposed a preexisting
reconstruction error at O0/g1 and O1/g1 on both official Luau pins. A local
copied before a closure captured its source by reference later read the
source's modified value. The original expected `4`; the output returned `7`.
The first research observation remains [32/36, with four failures](research-first-observation.json.gz).

## Cause and bounded correction

In the original `exercise` bytecode, `LOADK R2, 4` is followed by `MOVE R3, R2`.
The reconstructor names R2 because it will be captured, but R2 is not yet an
open reference cell. R3 therefore becomes an alias of that identifier. At the
first `CAPTURE REF R2`, `pinRefCapture` previously marked R2 as mutable without
materializing the earlier copy. A later call mutates R2 through its upvalue;
the deferred R3 read incorrectly observes that new value.

The raw AST already has this defect before cleanup or the new shared-guard
recovery. Disabling temporary folding does not repair it. Debug local metadata
at g2 happens to materialize the copy. The [triage records](triage.json), raw AST,
source and disassembly are preserved in [raw-observations.tar.gz](raw-observations.tar.gz).

The correction calls the existing `snapshotRegisterAliases` helper immediately
before a named, pinned binding becomes a reference cell for the first time.
Earlier copies retain their current values. Already-open reference cells keep
their existing path. No function body is rewritten, no closure moves, and no
new table or function is allocated. The unnamed-binding branch is unchanged.

The official VM implementations at
[9d7748a4](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lvmexecute.cpp)
and [c87565b8](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/VM/src/lvmexecute.cpp)
distinguish the value copy in `LOP_MOVE` from the open upvalue in `LCT_REF`.
Tovek [ce2ea332](https://github.com/Kiet1308/Tovek/tree/ce2ea3325547fa3896f274b68013386338039040)
`materialize_value_captures.rs` and `copy_cleanup.rs` were inspected for their
snapshot, capture and mutation invariants. This is an independent TypeScript
correction using our existing helper; no external implementation was copied.

## Validation

Three unchanged authored sources were checked at O0/O1/O2 × g1/g2 on both
actual native compiler/VM builds. Every input bytecode was sealed before the
fix and passed unchanged to the VM and decompiler. Acceptance requires normal
return and byte-exact stdout/stderr, as well as successful decompilation and
recompilation. Compiler, host, source and input hashes are retained.

| Check | Before | After |
| --- | ---: | ---: |
| Original `rejected-state` | 8/12 | 12/12 |
| Multiple copies, nil holes, table/function identity | 8/12 | 12/12 |
| Loop captures, later captures, closing and register reuse | 8/12 | 12/12 |
| Total native observations | **24/36** | **36/36** |
| New focused unit file | 1/4 | 4/4 |
| Related focused unit files | — | 23/23 |
| Complete unit suite, Node 22 | — | **1,804/1,804**, 155 files |

The twelve copies of the original research case use the same input bytes and
reproduce its exact initial observations; see [original-attribution.json](original-attribution.json).
The initial three failing unit assertions are retained in [unit-first.log](unit-first.log).
No assertion, original source or bytecode was weakened or excluded.
The [final runtime report](final-runtime.json) verifies that all original
observations remain unchanged. Directed review found no blocker within the
first-promotion scope.

## Quick diagnostic

The baseline replay reproduces the parent's strict Quick quality aggregate for
`885eb08`. Both diagnostic replays use the same 882 Quick bytecodes, empty query
and default options. No corpus, scorer, runner or validator was changed.

| Snapshot | Similarity | Normalized token ratio |
| --- | ---: | ---: |
| Baseline `885eb08` | 77.25692801599871% | 0.9854781501051264 |
| Corrected first REF promotion | 77.25739926437673% | 0.9854850474157070 |

The change is **+0.00047124837802 percentage points**: six profiles improve,
874 are equal, and two decline. This is a semantic repair with a very small
quality delta. Token ratio measures normalized tokens, not file bytes.
The replay is not a behavioral Quick pass; strict Quick belongs to the parent
integration. No Full or Hard benchmark tier was run for this correction.

## Evidence

- [validation.json](validation.json) and [provenance.json](provenance.json)
  identify the exact checks, snapshots and reference revisions.
- [initial-runtime.json](initial-runtime.json) and [final-runtime.json](final-runtime.json)
  preserve every original and recovered observation, including initial failures.
- [raw-observations.tar.gz](raw-observations.tar.gz) includes raw command records,
  original/recovered traces, recompilations and the raw reconstruction triage.
- [reproduce-native.py](reproduce-native.py) is the executed native control script.
  The immutable sources and 36 bytecodes are in
  [`tests/fixtures/ref-alias-promotion`](../../../tests/fixtures/ref-alias-promotion/manifest.json).
- [quick-comparison.json.gz](quick-comparison.json.gz) retains all 882 individual
  quality comparisons. [changed-source-pairs.json.gz](changed-source-pairs.json.gz)
  retains every changed original/baseline/candidate source pair. The complete
  baseline and candidate replay paths are recorded in their provenance files.
- [compressed-files.json](compressed-files.json) stores raw and compressed hashes
  and sizes. Gzip uses `mtime=0`; decompressed data and every tar member were
  checked byte for byte. [SHA256SUMS](SHA256SUMS) covers all archived deliverables.

Focused reproduction: `npx vitest run tests/ref-alias-promotion.test.ts`.
The recorded complete unit command is `npm test` on Node 22.
