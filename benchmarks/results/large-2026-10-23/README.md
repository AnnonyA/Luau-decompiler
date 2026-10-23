# PR59: six observed profiles repaired

The original pilot improves from **9/15 to 15/15 MATCH** (180/180 input runs). Cached LunaUX results remain **9/15**, Lua.Expert **15/15**. This matches Lua.Expert on these inputs and exceeds LunaUX's measured count; it does not demonstrate superiority on unseen programs. [Per-profile comparison](comparison.md), [machine-readable metrics](summary.json).

Query planner and reactive simulation are now **development regressions**, as explicitly requested after their first observation. Their sealed sources, reference bytes and competitor responses were not changed. The [first blind results](../large-2026-10-22/blind-comparison.md) remain historical evidence. No external requests were repeated for this pilot.

## First divergences and fixes

- **ReactiveGraph:add, O0 proto 15, pc 19:** failed boolean-pattern speculation advanced the environment's key register from `dependencies` to `dependents`. Restore all speculative state on failure. The fallback constructor also needs to assign its enclosing SSA phi; a branch-local table left that phi nil.
- **Query pack:** `{n=select("#",...), ...}` became keyed `[1]=...`, truncating a multiple-value tail to one result. Preserve SETLIST field provenance and its open positional tail even when named fields occur first. Explicit keyed calls remain scalar, and duplicate keyed writes must not shift positional fields.
- **Reactive route commit 3:** deferring `table.remove(route,1)` into an assignment's RHS evaluated the target's `#route+1` first, leaving a hole. Materialize calls before intervening table/metamethod reads.
- **Independent review:** closing a captured register must end its assignment ownership. Later constructor phis now allocate a fresh binding instead of overwriting the closed cell; both branches and all three debug levels were checked.

Four independently authored fixture sources plus unit assertions protect these cases. The official-VM fixture runner checks all 11 reductions at O0/O1/O2 (33 profiles). Each main fix was followed by the affected profiles and previous 200/24/36 suites. Review additionally exercised 15 small cases; pre-existing aliasing and nested duplicate-key problems were identified separately, not claimed fixed.

## Verification

Final local checks: 369 unit tests, 39 benchmark tests, 200/200 controlled semantic comparisons, 24/24 original-source profiles, 36/36 scope/register regressions, 33/33 reduced large profiles, and 15/15 large pilot profiles. Parser and demo checks are recorded in the evidence archive; remote CI is recorded separately once complete.

`evidence.tar.gz` preserves final sources, raw AST reconstruction, disassembly, VM traces, API cache records, CFG/SSA extracts, first-divergence diagnostics and test logs. Its SHA256 is recorded in `SHA256SUMS`. The second cohort has separate first-frozen evaluation evidence and is not included in this tuned score.
