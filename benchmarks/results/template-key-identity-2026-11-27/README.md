# Single-slot table keys and function write order

This continuation of [`ea133e3`](../single-template-field-2026-11-27/README.md)
preserves a one-key `DUPTABLE` allocation while recovering its final field value.
It also repairs two independently observed function-field errors and the empty
string key fallback. The implementation is confined to `Reconstructor.ts`.

## Changes and limits

- A field name and a literal string key can identify the same slot. The new
  cross-spelling deletion is allowed only for the original zero-valued slot of
  an exact one-string-key `DUPTABLE`, with no other fields or nested tables.
  Ordinary mixed-spelling literal writes remain present. `isPureValue` was not
  broadened; calls and unary expressions are not newly discarded.
- A function field is not lifted after its table literal when a later field can
  overwrite the same key. Known key aliases and dynamic keys are considered.
  This keeps closure creation and the final field write in their original order.
  Tables captured by their own closures still follow the existing early flush.
- A fallback `SETTABLEKS` assignment retains bracket syntax when its function
  expression has a different or absent debug name. Recompilation must not invent
  a function name from the field. The register value is consumed once.
- Invalid identifiers, including the empty string and keywords, use literal
  bracket keys for the reserved zero slot. The empty key must not become array
  index `1` when printed.

The loader's reservation is the numeric value **zero**, not `nil`. See the
official loader at [9d7748a4](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lvmload.cpp)
and [c87565b8](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/VM/src/lvmload.cpp).
Table reconstruction and capture invariants were also inspected in
[Tovek ce2ea332](https://github.com/Kiet1308/Tovek/tree/ce2ea3325547fa3896f274b68013386338039040),
including `rebuild_table_literals.rs`. This is an independent TypeScript
implementation; no competitor code was copied.

## Validation

The exact saved bytecode was executed, passed to the decompiler, and compared
with the recompiled output. Acceptance requires successful compilation, normal
VM return, and byte-exact stdout and stderr. The original observations remain
unchanged. See [validation.json](validation.json) and the individual reports.

| Control | Initial observation | Final observation |
| --- | --- | --- |
| Unit suite | Earlier intermediate logs retained | 1,600/1,600; 148 files |
| New alias/overwrite fixture, 12 profiles | 4/12 before and after the first key-only patch | 12/12 |
| New capture/dynamic-key fixture, 12 profiles | 4/12 baseline; 12/12 after function guards | 12/12 |
| Three prior table fixtures, 36 profiles | Earlier failures retained in the preceding report | 36/36 |
| Native Luau 9d7748a4, five sources plus early-read control | 28/36 baseline | 36/36 |
| Native Luau c87565b8, five sources plus early-read control | 28/36 baseline | 36/36 |
| Empty/keyword keys, Rosetta Luau 0.747 | 6/12; the empty key failed | 12/12 |
| Empty/keyword keys, native 9d7748a4 | 6/12; the empty key failed | 12/12 |
| Empty/keyword keys, native c87565b8 | 6/12; the empty key failed | 12/12 |

The 60 authored profiles include the already prepared normal and Hard
transformations. The two native pins are distinct compiler/VM builds, with
binary hashes in [native-pins-final.json](native-pins-final.json). Each pin
compiled its own original and recovered inputs. The fixture sources and saved
bytecodes are pinned in [fixture-files.json](fixture-files.json).

The first alias failure returned `1` instead of `2` after lifting an earlier
function write past an overwrite; other profiles gained an incorrect function
debug name. The first direct check matched only 8/24 observations across the two
engines. Those failures are preserved in [saved-alias-first.json](saved-alias-first.json)
and the raw archive. The final check matches all 12 unchanged inputs.

The initial unit logs also preserve incorrect assumptions about the AST's key
spelling and function representation. Assertions were corrected to the observed
AST contract; the runtime traces, fixtures and bytecodes were not changed or
excluded.

## Quick source-quality diagnostic

This is a diagnostic replay of the same **882** Quick bytecodes with query `""`
and options `{}`. It is not a behavioral Quick pass. The parent integration owns
the strict Quick gate. Full and Hard benchmark tiers are paused at the user's
request; this continuation did not run them.

| Engine snapshot | Similarity | Normalized token ratio |
| --- | ---: | ---: |
| Published main `36a344e` | 76.9282709511% | 0.9927495865 |
| Baseline including parallel assignments and `ea133e3` | 77.0724721371% | 0.9913299113 |
| Intermediate function/key guards | 77.0618765195% | 0.9902182630 |
| Final bounded correction | **77.0617460245%** | **0.9902219464** |

Against the immediate baseline, the final change is **−0.0107261126 percentage
points**: 170 profiles improve, 568 are equal, and 144 decline. Against published
main, this branch's complete locals work remains **+0.1334750733 points**. The
semantic repairs are retained despite their small negative score delta. Token
ratios measure normalized tokens, not byte size.

The intermediate replay predates the final restriction on ordinary mixed keys
and the empty-key correction. Both observations are retained. The final replay
used JavaScript tree SHA-256
`3f546d991bc29dd5da604b37a298c924228389ba0ad92ffd6f0125b37a748a89`,
which matches the final authored and native controls. See
[provenance.json](provenance.json), [quick-final-provenance.json](quick-final-provenance.json),
and [quick-final.json.gz](quick-final.json.gz).

## Known preexisting table-layout failure

An independent review fixture exposed a broader allocation problem:
`{ready = 1, beta = 8, ["ready"] = 5}` can have a different hash capacity and
iteration order after reconstruction. Keeping only the final value is not a
general layout proof. The existing same-spelling deduplication and the printer's
conversion of literal keys to record fields already affect this example.

The review's main baseline and intermediate candidate both fail the same six
pin/profile comparisons and emit byte-identical source. The final candidate
also emits exactly those same six sources; see
[layout-review-final-source-comparison.json](layout-review-final-source-comparison.json).
This is an unresolved earlier limitation, not a repaired case or a passing
control. A general solution needs allocation provenance and printing that
preserves the compiler's table layout. The new mixed-spelling deletion is
therefore restricted to the proven single zero slot. All first observations and
baseline attribution are in [raw-layout-review.tar.gz](raw-layout-review.tar.gz).

## Evidence and reproduction

- [raw-runtime-observations.tar.gz](raw-runtime-observations.tar.gz) retains initial
  and final input/output bytes, stdout/stderr, command records, and summaries.
- [raw-quick-intermediate.tar.gz](raw-quick-intermediate.tar.gz) and
  [raw-quick-final.tar.gz](raw-quick-final.tar.gz) retain all 882 records per replay.
- [quick-intermediate.json.gz](quick-intermediate.json.gz),
  [quick-final.json.gz](quick-final.json.gz), and
  [quick-versus-main.json.gz](quick-versus-main.json.gz) contain exact aggregate,
  section, profile, program and individual-profile comparisons.
- [reproduction-scripts.tar.gz](reproduction-scripts.tar.gz) contains the executed
  diagnostic scripts. Their absolute scratch paths identify the original run;
  the raw command records identify each compiler, VM and engine snapshot.
- [compressed-files.json](compressed-files.json) records raw and compressed
  hashes and sizes. Every gzip stream uses `mtime=0`; every decompressed byte and
  tar member was checked against its original. Compressed member manifests retain
  every original path and SHA-256. No engine snapshots or dependencies are bundled.
- [SHA256SUMS](SHA256SUMS) covers the archived deliverables. Unit and build logs
  remain unedited under `logs/`, including the first failed assertions.

To run the focused unit controls from the repository, use
`npx vitest run tests/template-key-identity.test.ts`. The recorded full unit run
used `npm test` on Node 22. No corpus, scorer, runner or validator was changed.
