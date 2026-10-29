# Private-table inline recovery — 2026-10-28

Compared with `bd4dc1071ead6b07f3849b49def03d9f24734d96` (PR #65), the engine
can recover existing void helpers from ordered private-table writes and branches.
Early helper returns match guarded continuations; caller returns remain exits.

| New original | Demonstrated behavior |
|---|---|
| inlined-table-updates | O2's conditional stores become `record(config, i)`; before/after observations stay identical. |
| inlined-table-write-branches | `classify(j, config)` is recovered across nested loops, stable numeric captures, numeric keys and a second-position table parameter. |
| inlined-table-write-effects | Metatable callbacks, frozen-table failures and observable aliases retain their effects; unsafe writes stay in the caller. |

The [examples](examples) contain reconstruction before/after the change from
identical O2 bytes, official disassembly, raw AST, final AST and CFG/SSA evidence.
[examples.json](examples.json) records bytecode/output hashes. Original sources
and their O0/O1/O2 bytecode are in `tests/fixtures/object-optimized`.
[new-fixture-traces.json](new-fixture-traces.json) records 45 new profile/style
results and their 135 input executions against original-source observations.

Validation on the final implementation: **471 unit tests**, **46 harness tests**,
**810/810** style/optimization profiles with **1,185** input executions; historical
**200/200**, **24/24**, **36/36**; two large cohorts **30/30**; observed independent
regressions **9/9**; seeded fuzzing **90/90**. Official parsing and execution pass,
as do the six demo tests and the Chromium browser test. Report hashes and engine
identities are in [validation.json](validation.json). CI separately checks Node
20/22, the official parser/runtime and browser demo before integration.

Review found a lexical-scope bug in composition with scalar recovery. An argument
expanded from an earlier initializer reused a node scheduled for replacement in
the old scope; a newly inserted call could consequently call a shadowing number.
A failing regression reproduced this, and copying already-proven arguments
prevents those old-site rewrites from moving into the new scope. The test checks
both the permitted initializer rewrite and the unchanged arithmetic argument.

The new effects fixture initially concatenated a nil callback value, making its
original execution invalid. The logger now uses `tostring`, and all three new
bytecode files were regenerated before the successful final matrix. No sealed
original, reference bytecode, competitor result or existing assertion changed.

See the [pinned reference study and proof limits](../../../docs/references/tovek-private-table-recovery.md).
These three programs are development regressions, not blind competitive evidence.
No external API requests were made, and this round does not establish superiority
over LunaUX or Lua.Expert. General effectful helpers, mutable captures and open
multiple returns remain outside this recovery proof.
