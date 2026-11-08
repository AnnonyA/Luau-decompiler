# Return structure, result names and observable function names

Baseline: `3c26857df42e82d39866c85e15dff0ac3a8ba893` (PR #71).
Official Luau: `9d7748a4f324213a18cb8283fa2a77c330225fa0`.
No external API requests. Existing sealed sources, bytes and competitor
responses remain unchanged. All new programs are development regressions.

Scratch cleanup exposed scalar returns too late for conditional-expression
recovery. A final bottom-up pass now recovers `return if` after temporary folding,
reusing the existing guards against open return packs. It does not rerun naming
or move effects. Owned empty-table results can take a named getter/factory's
result stem; hints cannot flow from nested functions to outer captured bindings.

Review exposed a name-allocation hazard: an inferred table name could consume a
later function's explicit name and alter `debug.info(fn, "n")`. Explicit/function
names are now reserved, and rejected suggestions are not consumed. Official VM
validation then found that the existing compact/PascalCase pass independently
changed those debug names. Styling now preserves function declaration names,
including forward declarations and local function-expression initializers.
Parameters and ordinary locals still follow the selected naming style.

| New original | O0 | O1 | O2 | Inputs per profile |
| --- | --- | --- | --- | --- |
| return-selection | MATCH | MATCH | MATCH | 3 |
| getter-result-scopes | MATCH | MATCH | MATCH | 3 |
| getter-debug-names | MATCH | MATCH | MATCH | 3 |

The first program observes branch effects, false/nil, scalar versus open returns
and sort order. The others observe table identity, nested readers, global/parameter
collisions and prototype names. Across five naming styles, `getter-debug-names`
had 9 MATCH / 6 MISMATCH before the NameStyle fix and 15 MATCH afterward.
`debug-names-before-after.json.gz` preserves both measurements, including errors
and VM output; the first measurement includes the preceding inference changes.

The private supplied IndexUI now uses `nukeIds`, `commanderIds`,
`explosionVFXIds`, `mutationIds` and `baseSkinIds` for getter results. Four
comparators become conditional returns, reducing standalone else lines from 62
to 58 and source lines from 1495 to 1479. Its source passes the official parser;
complete Roblox execution remains **not measured**. Private source and bytecode
are neither committed nor transmitted. This is not a competitive superiority
claim or a claim of recovering all original source structure.

Validation:

- 625 unit tests, typecheck/build, 50 benchmark harness tests.
- 6 demo tests and 1 real Chromium test.
- 4335/4335 rewrite profiles (8262 input comparisons).
- 1275/1275 naming profiles (2430 input comparisons).
- Existing 200/200, 24/24, 36/36, both large cohorts 15/15 each,
  independent regressions 9/9 and generated profiles 18/18.
- Tovek: 47/47 decode and official-parser checks, not 47 semantic matches.

Tovek V2.7 `refine_names.rs` was consulted at
`a70720174f61028af9e38e8f6761d18c422c0bc7`; implementation is independent.
The public fixture corpus remains pinned to `77edf387`.

Compressed reports contain parser/runtime observations and source/bytecode
hashes. `summary.json` hashes the compressed files. Reproduce through
`bench:large:regressions --rewrite-options` / `--name-styles` with the pinned
`--luau-compile`, `--luau` and `--output` arguments used in CI.
