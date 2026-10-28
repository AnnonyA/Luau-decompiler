# Numeric helper recovery and measured performance

Reference: Tovek MIT revision `77edf387bf280a2f4d46d57ac85d5c4f071b763f`,
`ast/src/expr_deinline.rs`, `ast/src/deinline/evidence.rs` and
`ast/src/deinline_safety.rs`. These motivated exact matching, argument stability,
line evidence and rejecting frame-observable transformations. No Rust implementation
was copied; the TypeScript pass uses our lexical binding identities.

Official Luau revision `9d7748a4f324213a18cb8283fa2a77c330225fa0`,
`Compiler/src/Compiler.cpp::tryCompileInlinedCall` explains copied bodies and
fixed-return restrictions. `VM/src/lvmload.cpp` and `VM/src/ldebug.cpp` define line
metadata: uint8 offsets accumulate modulo 256 across all PCs; signed base-line
deltas accumulate across intervals. Our previous line lookup lost both rules.
Normalized lookup data now has weak ownership and O(1) lookups after one linear
pass. Serialized metadata remains unchanged.

Recovery only uses a preceding, immutable local helper with one scalar return,
no free captures and no varargs. Matching preserves exact operator order and
constant values. Arguments must be provably primitive numeric expressions from
immutable locals or numeric loop variables. Calls, unknown values, metamethods,
mutable captures, missing arguments and multiple returns are excluded. Each
parameter occurrence must match the same lexical value. A shared line between
prototypes admits a candidate, but exact matching and semantic checks authorize
the rewrite. Missing/ambiguous metadata leaves the expression intact. A continue
in a repeat body prevents new body helpers from being called in until.

The pass has a deterministic work budget, including numeric proofs, and memoizes
expression identities. It does not invert constant folding, recover arbitrary
statement regions or prove a uniquely original call site. Existing helper calls
are recovered only where observable primitive operations are preserved.

`recoverInlinedFunctions: false` or `recover_inlined_functions=false` disables
recovery. The browser has a matching checkbox. Other naming/formatting options
continue to apply.

Performance profiling found repeated suffix searches, module-global rescans and
unnecessary list/scope copies. Suffix cursors reset on speculative rollback;
global reservation runs once per reconstruction allocator; SSA tracks version
counts; liveness appends use/def PCs; lexical lookup scans scopes without copies.

Run `npm run bench:performance -- --baseline /path/to/baseline/dist/decompile.js
--luau-compile /path/to/luau-compile --output /tmp/performance`. Build the baseline
from commit `4f059cf0b9381bf534a600c88a2e8338608fbde9`. The runner verifies all
sealed source/bytecode hashes, uses isolated sequential workers and alternates
engine order. Five measured samples follow one warmup. GC is outside timed
regions. It records engine hashes, raw samples, medians, p95, process peak RSS and
retained result heap. Recovery-disabled outputs must match source, AST,
disassembly, diagnostics and validation exactly; current default mode is measured
separately. Semantic equivalence is checked by the existing official-VM suites.
The measured report and semantic regression traces are stored in
[`performance-inline-2026-10-28`](../../benchmarks/results/performance-inline-2026-10-28/README.md).
RSS includes the runtime and warmup and is not an allocation profiler; results
apply to the recorded machine/corpus, not all inputs or competitor performance.
