# One-field table templates: source recovery and real loader values

The decompiler can recover a split, single-field table initializer when the
bytecode proves that `DUPTABLE` reserved exactly that string key. This change also
fixes the fallback for an interrupted constructor: Luau's loader initializes a
key-only reservation to numeric **zero**. Printing an empty table lost both that
observable value and the original hash allocation.

## Independent observations, including the first failures

Three project-authored sources exercise initializer effects, hash growth and
`next`/iteration order, nil and multiple results, anonymous function names, and
saved table/closure identity. The original sources and all 36 bytecodes remain
unchanged in [the fixture manifest](../../../tests/fixtures/single-template-field/manifest.json).

| Check | Before this change | Initial recovery only | Final recovery and zero reservation |
| --- | ---: | ---: | ---: |
| Authored Rosetta check, 12 profiles per source | 33/36 | 33/36 | 36/36 |
| Exact saved bytecode executed by the official VM | 33/36 | 33/36 | 36/36 |
| Synthetic early field read, six output compile profiles | 0/6 | Not run | 6/6 |

The first three differences were all `template-layout-effects`, at O2g1, O2g2
and O2g2+x1. The baseline and initial candidate printed byte-identical recovered
source for those failures. Executing the exact original bytecode confirmed the
difference, so it was **not** an O0 source-oracle artifact. The lost reservation
changed later table growth and iteration order. The final candidate preserves
that reservation and matches every original stdout/stderr observation, including
normal return. All 36 original observations were checked again and remained
byte-identical to the first run.

The synthetic input reads `t.ready` before `SETTABLEKS`, prints it, stores 5 and
prints again. The official VM prints `0`, then `5`; the old engine printed `nil`,
then `5`. The repaired output matches under O0/O1/O2 at g1/g2. This control uses
one manually authored official bytecode input and six output compiler profiles;
it is separate from the 36 compiler-produced normal and Hard inputs.

The raw [first check](authored-initial.json), [repaired check](authored-repaired.json),
[first saved-bytecode comparison](saved-bytecode-initial.json),
[repaired saved-bytecode comparison](saved-bytecode-repaired.json), and
[synthetic observation](synthetic-observation.json) are retained. Full traces,
generated source, bytecode hashes and command records are in
[initial traces](saved-traces-initial.json), [repaired traces](saved-traces-repaired.json)
and [synthetic traces](saved-traces-synthetic.json). The repaired Rosetta check
process still exits 1 because it reports the baseline's three mismatches; the
candidate's own count is 36/36, with no other outcomes.

## Actual source-similarity result

This diagnostic replay uses the unchanged 882 Quick bytecodes, the exact Rosetta
token scorer, default options, and Node 22.23.5. The baseline is the preceding
parallel-assignment commit `0a78f47`.

| Measurement | Baseline | Initial recovery only | Final candidate |
| --- | ---: | ---: | ---: |
| Source similarity | 77.0847657708% | 77.1320771265% | 77.0724721371% |
| Normalized token ratio | 0.9908493704 | 0.9898004218 | 0.9913299113 |
| Local ratio | 1.0874242389 | 1.0855315469 | 1.0855315469 |

The final net change is **−0.0122936337 percentage points**: 90 profiles improve,
652 are equal and 140 decrease. The zero fallback costs source tokens when the
constructor cannot yet be recovered. It is kept because the independent runtime
observations prove that dropping it is incorrect. The initial +0.0473113557-point
gain is an intermediate measurement, not the final result.

See the [first diagnostic](quick-diagnostic-first.json.gz),
[initial guarded diagnostic](quick-diagnostic-initial.json.gz), and
[final diagnostic](quick-diagnostic-final.json.gz). These token measurements are not
behavioral passes for the whole Rosetta suite. The four strict integration tiers
remain pending.

The three complete diagnostic JSON files use lossless gzip compression with a
zero timestamp. Decompression was checked byte for byte against the originals;
no observations were summarized or removed. [compressed-files.json](compressed-files.json)
records both raw and compressed SHA-256 hashes, sizes, and the original commit
`ea133e3`. The original files also remain in scratch. `gzip -dc <file>.json.gz`
recovers the exact original JSON bytes.

## Proof limits

- Only a key-only `DUPTABLE` with exactly one string key receives this recovery
  evidence. Templates containing constant values and multi-key templates are
  outside this change.
- A field store must immediately follow the table declaration, target that same
  reserved key, and neither read nor capture the unfinished table. Its value
  keeps its scalar field context and original evaluation order.
- Indexed recovery excludes invalid identifiers, metamethod names and every
  initializer containing a function literal, including inside conditionals,
  arguments or nested tables. Existing bracket spelling preserves anonymous
  function debug names.
- The recovery can replace the unobserved loader zero for that one slot. It
  cannot append unrelated fields, absorb later overwrites, cross an observer or
  move table creation across an effect.
- When recovery cannot be proved, the real zero slot stays visible. The change
  does not claim complete allocation/layout reconstruction for larger tables.

Build and all **1,585 unit tests in 147 files** pass. The new suite contains 19
tests, including pinned input hashes and AST validation for every saved profile.
The first six structural-test failures are preserved in
[initial-shape-assertion.log](initial-shape-assertion.log): those AST fixtures had
no later table use, so existing single-use folding removed the declaration before
the intended assertion. The tests now return the table, giving the declaration
the observable lifetime their assertions require. The authored Luau sources were
not changed or excluded. See [validation.json](validation.json),
[full-unit.log](full-unit.log) and [provenance.json](provenance.json).

## Engineering references

Inspected Tovek's `ast/src/rebuild_table_literals.rs` at
[`ce2ea332`](https://github.com/Kiet1308/Tovek/tree/ce2ea3325547fa3896f274b68013386338039040)
for reservation, allocation and table-observation invariants. Its MIT license was
verified. This is an independent TypeScript implementation; no Rust code was
copied.

Official Luau's `VM/src/lvmload.cpp`, at both
[`9d7748a4`](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lvmload.cpp)
and [`c87565b8`](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/VM/src/lvmload.cpp),
uses `setnvalue(val, 0.0)` for `LBC_CONSTANT_TABLE`. The Rosetta-pinned Luau 0.747
loader was checked independently and agrees. `compileExprTable` and VM
`LOP_NEWTABLE`/`LOP_DUPTABLE` establish why keeping the same reservation matters
before later stores. Compiler-host and engine digests are recorded in provenance.
