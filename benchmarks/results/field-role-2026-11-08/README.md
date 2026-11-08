# Field-role naming with observable function-name protection

Incremental baseline: `dc4ec66c495dafbafc2bbaf3bb23ef9a080256c8` (PR #72).
Official Luau: `9d7748a4f324213a18cb8283fa2a77c330225fa0`.
No external API requests. Existing originals, pinned bytes and cached competitor
responses are unchanged. Both new programs are development regressions.

Generated locals initialized from `record.Field or <literal>` or
`record and record.Field or <literal>` can use the field's role. Guards must name
the same receiver; competing field/default expressions retain the existing name.
This only changes binding names and their resolved references. It does not move
or eliminate property reads, short-circuit tests or effects.

Review caught a regression in the initial implementation: a later field fallback
assignment could rename an earlier function if its spelling looked generated.
Name allocation now preserves function bindings' own names as well as reserving
them against other suggestions. The focused test failed before this correction
and passes afterward. This prevented an introduced regression, rather than
establishing a baseline semantic failure in the previously merged engine.

Official execution also exposed an earlier O0 reconstruction collision: a
generated `tonumber` temporary consumed the name of a later genuine function.
The reconstructor now keeps valid prototype names available for their owners,
including forward REF cells, while preserving global reservations and rollback.
For `reassigned-function-name`, the five-style matrix improves from 10 MATCH /
5 MISMATCH to 15 MATCH after this fix. `prototype-names-before-after.json.gz`
preserves those observations. Missing debug names and arbitrary same-named
prototype collisions remain outside this bounded correction.

| New original | O0 | O1 | O2 | Inputs per profile |
| --- | --- | --- | --- | --- |
| fallback-property-names | MATCH | MATCH | MATCH | 3 |
| reassigned-function-name | MATCH | MATCH | MATCH | 3 |

They observe metatable reads, nil/false defaults, sorted results, nested captures,
explicit-name collisions and saved function aliases/debug names after a local is
overwritten. `focused.json.gz` contains all 30 profiles across five naming styles.

In the private supplied IndexUI, seven generated field-fallback bindings now use
`order3`/`order4` in place of generic `result` names. Suffixes avoid explicit names
elsewhere in the chunk. Full output passes the official parser. Roblox execution
remains **not measured**; no supplied bytecode/source is committed or uploaded.
The preceding return/getter improvements and their evidence remain in
`../return-structure-2026-11-07/`.

Final validation for all PR #72 changes:

- 635 unit tests, typecheck/build, 50 benchmark tests.
- 6 demo tests and 1 real Chromium test.
- 4437/4437 rewrite profiles (8568 input comparisons).
- 1305/1305 naming profiles (2520 input comparisons).
- Existing 200/200, 24/24, 36/36, both large cohorts 15/15 each,
  independent regressions 9/9 and generated profiles 18/18.
- Tovek: 47/47 decode and official-parser checks, not 47 semantic matches.

Reference: Tovek V2.7 `a70720174f61028af9e38e8f6761d18c422c0bc7`,
`ast/src/refine_names.rs`; implementation is independent. Corpus pin remains
`77edf387`. Compressed reports preserve parser/runtime observations and hashes.
`summary.json` hashes each full report. Reproduce with the existing
`bench:large:regressions --rewrite-options` / `--name-styles` commands and pinned
`--luau-compile`, `--luau`, `--output` arguments as in CI.
