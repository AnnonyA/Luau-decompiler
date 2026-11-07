# Rewrite controls, fixed tuples and REF capture identity

Official Luau `9d7748a4f324213a18cb8283fa2a77c330225fa0`; local Node 24.19.0.
Compressed JSON retains parser results, bytecode hashes and execution traces.
`summary.json` records report hashes and measured counts. No competitor requests
were made. The three new originals are development regressions, not blind tests.

| Gate | Result |
|---|---:|
| 72 originals × O0/O1/O2 × 17 rewrite configurations | 3,672/3,672 MATCH; 6,273 input comparisons |
| 72 originals × O0/O1/O2 × five naming styles | 1,080/1,080 MATCH |
| Previous semantic / competition / scope corpora | 200/200, 24/24, 36/36 MATCH |
| Large pilot / second cohort | 15/15, 15/15 MATCH |
| Previously independent regressions / seeded fuzz | 9/9, 18/18 MATCH |
| Tovek pinned inputs | 47/47 decode and parser PASS |
| Tovek paired-source observations | 10 MATCH, 37 NO MEDIDO |
| Unit / harness / demo / Chromium | 574 / 50 / 6 / 1 passed |

All 14 browser controls now reach implemented engine options. New bounded
rewrites name exact math constants without global lookups, reroll numeric unit
strides, unfold inert module fields, remove unreferenced private functions, emit
const for proven immutable locals, preserve UTF-8 bytes when escaping Unicode,
and print capture/line metadata. Existing structural/folding passes now expose
their controls. See the main README for defaults and limits.

Fixed tuple recovery reconstructs retained helpers with 2–4 primitive results,
preserves existing lexical destinations and rejects clipped/ambiguous patterns.
Review caught excess locals inside repeat, hidden loop registers and nested wide
argument packs. Direct assignments and conservative register budgets prevent
these optional rewrites from making valid source uncompilable.

The new `numeric-rewrites/O1` originally failed all 17 option configurations:
a REF capture's earlier writes disappeared, allowing the compiler to fold its
constant initializer and share two originally distinct closures. Resolved REF
cells with no surviving writes now retain declaration-plus-assignment. Existing
mutations stay intact. The pre-fix report records 3,655 MATCH and 17 MISMATCH;
the final report records 3,672 MATCH. Original sources and bytes were unchanged.

Reproduce using `bench:large:regressions -- --rewrite-options` and `--name-styles`,
plus the existing semantic/competition/regressions/large/independent/fuzz/Tovek
commands with the pinned compiler/runtime. CI runs the option matrix as a
required parser/runtime step and verifies Node 20/22 and the browser demo.
The 17 configurations are not an exhaustive 2^14 combination test. This round
makes no new claim of competitive superiority or universal reconstruction.
