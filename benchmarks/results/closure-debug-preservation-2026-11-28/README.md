# Closure debug names: bounded correction

This change preserves an original prototype's name when a named closure is
stored under a different record key, or when an existing shared-closure factory
or dispatcher loads its one physical function literal. It adds no table,
function literal, call or call frame. A declaration inside the existing
factory, or a `do` scope in the existing dispatcher, supplies the original name.

The exact-name declaration is allowed only when that name is not free anywhere
in the function, including descendant functions. Parameters and local shadows
are resolved lexically. Dispatcher temporary names also reserve literal debug
names, so an inner named declaration cannot capture its result cell.

`Reconstructor.onlyField` now requires a named prototype's name to match its
record key. `AstCleanup` preserves declaration names when converting a
declaration back to an expression, and does not turn an aliased export into a
differently named field declaration. Recorded anonymous prototypes remain
anonymous under that export rewrite.

## Results and limits

| Check | Baseline | Accepted candidate |
| --- | ---: | ---: |
| Original named-table controls, two compiler pins, O0/O1/O2, g1/g2 | 24/36 | 36/36 |
| Additional authored global-homonym controls, same profiles | 0/12 | 4/12 |
| Independent allocation control, valid O1/O2 originals | 8/8 | 8/8 |
| Rosetta 3 Quick source replay, 882 inputs | 77.49586128999316% | 77.49845213900888% |

The source gain is **0.00259084901572 percentage points**. Four json profiles
improve; one mutant profile declines by 0.157845 percentage points. The other
877 outputs are unchanged. `quick/changed.json` gives each change, and
`quick/records.json.gz` retains original bytecode hashes, output hashes and raw
quality fields for all 882 cases. The replay is a source diagnostic with
`behaviorVerified: false`; its historical `baselineQuality` field refers to
an older 72.29585% run. The current comparison is the separate
`quick/baseline.json`, from the same unchanged `fc6e10a` engine tree.

The eight authored failures are explicitly **pending**. At O0, a function whose
debug name equals a free global can still receive an allocator suffix. At O2,
a shared function whose body refers to that global cannot safely become a
same-named recursive local declaration; its factory name is still lost, and
the separate repeated-record path still loses function identity. Introducing
a same-named local would rebind the free global. This patch deliberately leaves
those paths unchanged instead of adding a table, snapshot or global lookup.

The authored fixture and all 12 compiled inputs are sealed in
`tests/fixtures/closure-debug-preservation/manifest.json`. They retain the
first source and bytecode hashes. The unit tests check sealing, lexical
bindings, aliases and the helper's scope guard; they do not claim native
success for the eight pending cases. Targeted unit tests passed 34/34.

The named-table fixture is owned by the parent integration branch at
`tests/fixtures/named-table-closures/`. It checks effects, names, records,
identity and return packs. Both the first independent baseline observations
and the candidate observations are retained here. Native runs use Node
22.23.5 and both original compiler pins. Full Node 20/22, demo and strict Quick
validation remain integration gates.

## Rejected table wrapper

The first implementation used `({tag = function() ... end}).tag`. It preserved
names and avoided lexical shadowing, but allocated an extra record. Independent
review measured **31 KiB** of extra allocation in a 200-pair repeated-constant
control with garbage collection stopped after loading. Original and baseline
O2 bytecode allocated zero in that interval. This implementation is rejected.

`rejected-table-wrapper/` preserves its implementation, and the native reports
preserve its initial failures and later apparent 12/12 name success. That
12/12 result is not an accepted semantic pass because the independent allocation
control failed. Removing the wrapper returned every valid allocation control
to zero. The first O0 allocation control itself assumes cached identity and
fails in the original VM; those four rows remain recorded as invalid originals,
not passes.

`independent-allocation/` contains the reviewer's original source, host source,
commands, snapshots, first outcome and the no-table outcome. Its no-table
snapshot precedes only the defensive dispatcher-name inventory addition and
removal of an unused experimental field-site expansion. Parent integration
rechecks the frozen integrated build.

`native/raw.tar.gz` and `independent-allocation/raw.tar.gz` preserve the exact
stdout, stderr, commands, reconstructed source and bytecodes from these runs.
The plain JSON summaries retain all observed failures. No original input,
scorer, corpus-specific rule or expected native output was modified.

## References and implementation provenance

The implementation is independent; no reference code was copied.

- Tovek `ce2ea3325547fa3896f274b68013386338039040`: MIT license and the
  deinline/capture safety invariants in `ast/src/deinline_safety.rs` and
  `expr_deinline.rs`.
- Official Luau `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f` and CI pin
  `9d7748a4f324213a18cb8283fa2a77c330225fa0`: `Parser.cpp` function declarations
  and record-field debug names; `Compiler.cpp` debug-name emission and closure
  sharing; `lvmexecute.cpp` constant closure behavior.

`local tag = function() return tag end` does not supply a debug name in either
pin. Only the appropriate declaration or record-field syntax does. A local
function declaration additionally introduces a recursive binding, which is
why the free-name guard is required.
