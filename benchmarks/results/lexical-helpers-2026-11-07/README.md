# Lexical helper recovery and source presentation

Baseline: `ec2f21a2e877b21c4d18e031a5482d604cdbbf82` (PR #69).
Official Luau: `9d7748a4f324213a18cb8283fa2a77c330225fa0`.
No external API requests. Three project-authored programs, O0/O1/O2, three
deterministic inputs per profile. These are development regressions.

| Program | Baseline O0/O1/O2 | Updated O0/O1/O2 |
| --- | --- | --- |
| inlined-lexical-helpers | MATCH / MATCH / MISMATCH | MATCH / MATCH / MATCH |
| named-function-cells | MATCH / MATCH / MISMATCH | MATCH / MATCH / MATCH |
| anonymous-function-name | MATCH / MATCH / MATCH | MATCH / MATCH / MATCH |

The first O2 failure duplicated a cached closure literal after an unknown call.
A bounded factory now preserves the VM's environment-sensitive cache check at
each load. The second failure lost the old function value when a new closure
overwrote a REF cell; closure assignments now snapshot deferred register aliases.
Both failures existed before this round. The initial draft of the second program
also printed an address; the permanent fixture compares function identities
explicitly, without process-dependent output.

Helper recovery now crosses function boundaries only for an already-captured,
initialized, stable helper. Exact free-binding checks prevent capture changes.
Named assignment syntax preserves forward locals and is emitted only when it
preserves the prototype's genuine debug name. The anonymous-name regression
catches an unsafe version of that presentation rewrite found during review.

The demo, CLI and HTTP output include the requested version/date/bytecode header.
Core library source remains deterministic. The supplied IndexUI file was checked
locally: 17 of its 20 anonymous assignment forms can safely use named syntax;
all function assignments are separated from following statements. Its complete
source passes the official parser. Full Roblox execution is **not measured**;
neither the uploaded bytecode nor competitor output is committed or transmitted.
Helpers calling unknown external modules remain outside the recovery proof.

Validation:

- 597 unit tests, typecheck/build, 50 benchmark harness tests.
- 6 demo tests and 1 real Chromium test.
- 4029/4029 rewrite profiles (7344 input comparisons).
- 1185/1185 naming profiles (2160 input comparisons).
- Existing 200/200, 24/24, 36/36, pilot 15/15, cohort 2 15/15,
  independent regressions 9/9, generated profiles 18/18.
- Tovek: 47/47 decode and official-parser checks; this is not a claim of full
  semantic equivalence for those scripts or competitive superiority.

Compressed reports preserve VM observations, parsing results and hashes.
`summary.json` records report hashes and counts. Reproduce the new fixtures with
`bench:large:regressions --rewrite-options` or `--name-styles`, supplying the pinned
`--luau-compile`, `--luau` and an `--output` directory as in CI.
