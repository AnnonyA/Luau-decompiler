# Second cohort: observed regressions repaired

AnnonyA improves from **9/15 to 15/15 MATCH**, with all 180 deterministic input runs matching the official VM. Cached LunaUX is 10/15 (120/180 inputs); cached Lua.Expert is 15/15 (180/180). No external requests were made in this round. See [per-profile comparison](comparison.md), [metrics](summary.json) and [validation](validation.json).

These are tuned development results. Constraint-search and geometry-pipeline were promoted to development regressions before correction, recorded in `benchmarks/large/cohort2/observed-cohort.json`. The independent first measurement remains [0/15 vs 10/15 vs 15/15](../cohort2-2026-10-23/first-comparison.md). Matching Lua.Expert and exceeding cached LunaUX on this now-observed corpus does not establish superiority on unseen systems. There are still ten large systems in two cohorts; expansion to fifty and a new independent evaluation remain pending.

## Causes and repairs

- **Terminal CFG blocks:** a RETURN could absorb the compiler's following unreachable jump, creating false continuations. Every terminator now ends its block.
- **Nested iteration regions:** a generic/numeric for and its first inner loop can share a header. Keep separate regions, include nested backedges in the outer region, and retain mutable iterator phis needed by the inner loop.
- **Loop continuations:** reaching a for latch terminates the current iteration; crossing its exit emits a break. Both branch polarities are preserved. Continue inversion is restricted to a whole loop body, so nested guards still skip enclosing effects.
- **Binding ownership:** loop scopes no longer leak into following loops. Dead incoming values do not initialize latch join bindings. Terminal paths cannot contaminate the normal exit, and a successful speculative expression retains declarations from its emitted prelude.
- **Evaluation order:** effectful values are materialized before independent calls. This preserves the original random-number consumption order when O2 inlines a constructor receiving several calls.

The first geometric divergence (hull size) was a lost inner while. Later traces exposed an out-of-scope iterator in resample, reused locals in vertexNormals, reordered calls in box-query, and a forgotten prelude declaration in stitchSegments. All twelve inputs now agree at O0/O1/O2. Constraint-search's premature node-limit and syntax failures are also gone.

Nine new small VM fixtures cover these mechanisms, including independently reviewed shared-header repeat/return variants. The small suite is 90/90 across O0/O1/O2. One old synthetic while test had an unconditionally returning body and an unreachable backedge; its fixture now contains a reachable backedge, with its original assertions retained. The open-call test now resolves AST bindings and checks exact arguments, call count, evaluation order and the open trailing pack, instead of requiring a particular nested-call format.

## Official-source compatibility audit

The pinned official VM's `LOP_CONSTRUCT` (`VM/src/lvmexecute.cpp:3783`) writes R[A] from class R[B]; AUX is a feedback slot. `LOP_FINCONSTRUCT` skips the following constructor CALL on success. Decoder annotations and its target now reflect those operands. A project-authored experimental class example prints 13 officially but previously produced a nil call in our output. Unsupported class instructions now return an explicit `unsupported-opcode` diagnostic rather than silently omitted source. This is honest unsupported classification, not class reconstruction support.

## Verification

387 unit tests, 39 benchmark tests, 200/200 semantic comparisons, 24/24 competition originals, 36/36 earlier regressions, first pilot 15/15, second cohort 15/15, and 90/90 reduced VM profiles pass locally. Official parser: 25 local and 22 published fixtures pass; every large MATCH also passed the parser. Demo: three worker tests and the Chromium browser test pass. Node 20/22, parser/VM and demo CI must also pass before squash merge.

`evidence.tar.gz` contains the final local/development/observed reports, sources, bytecode, AST, disassembly, VM traces and cached competitor responses. `SHA256SUMS` covers the report artifacts. Sealed originals, reference bytecode and competitor outputs remain unchanged.
