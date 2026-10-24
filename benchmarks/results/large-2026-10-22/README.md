# Large-system pilot, 2026-10-22

Five original generated systems, 1,072–1,429 significant physical lines each. Fifteen profiles (O0/O1/O2), twelve deterministic input pairs each: 180 executions per measured engine. These are five architectures with specialized generated handlers, not thousands of independent handwritten statements.

| Cohort | AnnonyA | LunaUX | Lua.Expert |
|---|---:|---:|---:|
| Development before fixes | 0/9 | 6/9 | 9/9 |
| Development after fixes | 9/9 | 6/9 | 9/9 |
| First reserved evaluation | 0/6 | 3/6 | 6/6 |
| Entire pilot | 9/15 | 9/15 | 15/15 |

AnnonyA beats LunaUX on transaction-store's three profiles, while LunaUX beats AnnonyA on query-planner's three profiles. Lua.Expert matches all fifteen; this pilot does **not** establish superiority over Lua.Expert or universal accuracy. Reactive-simulation fails for both AnnonyA and LunaUX. Every failure remains MISMATCH.

[Automatic per-profile comparison and resources](comparison.md) · [JSON metrics](summary.json) · [First blind evaluation](blind-comparison.md).

## Engine improvements

- Receiver renaming resolves lexical bindings through loops, conditions and nested closures.
- Register definitions use actual SSA phi operands, avoiding ownership inherited from unrelated earlier register values. Mutable forward captures retain their identity until CLOSEUPVALS.
- Nested loop headers are emitted before child loop preparations; effectful latches run instead of being skipped by `continue`.
- Loop phi liveness follows CFG paths and continuation uses; initial values survive conditional updates and zero-iteration paths.
- Shared nonterminal branch regions are emitted on both reachable paths.
- Accumulator coalescing accounts for compound-assignment reads, all previously merged values, captures and scope ambiguity.
- Mutable upvalue reads are materialized before intervening loop writes; discarded method-call preparations are consumed.
- Independent review found and corrected two additional regressions: inner bindings replacing an established outer phi, and deferred expressions observing later mutations of their lexical operands.

Seven small independent regression sources are compiled at all three optimization levels (21 MATCH). The unchanged 200/200, 24/24 and 36/36 baselines pass, as do 365 unit tests, 39 benchmark tests, 25 generated-source parser checks and 22 published-reference parser checks. Demo tests/build pass locally. GitHub Actions status is recorded separately in integration.md; this document is not a claim that CI or all semantics are green.

## Unresolved failures and merge gate

All six reserved profiles still fail, including without cleanup. Query-planner first errors while computing a checksum: a reconstructed closure attempts the length of nil. Reactive-simulation first errors in `add`, called by `makeWorld`, also attempting the length of nil. Exact parser/VM traces and reconstructed sources are preserved. These observations locate runtime failures; decoder/SSA/closure root causes are **not yet established**. The reserved implementations were not used to tune this engine. A new independent reserved cohort is necessary before treating future tuned results as blind evidence.

The strict CI gate includes the failing reserved corpus and must block merge. Expansion to at least fifty independent large systems remains pending; the five-program pilot has not met semantic acceptance. No assertions were weakened, references changed, failures omitted or API results relabeled.

## Reproduction and evidence

See [runner instructions](../../large/README.md). Source and bytecode hashes are sealed. `evidence.tar.gz` retains original sources, exact bytecode, compiler/version/options metadata, raw reconstruction, disassembly, final AST, external requests/responses, traces, before/after measurements and baseline validation. Both the first freeze and post-review freeze are retained; post-review reserved runs reuse the same cache and are not new blind evaluations. The independently found review regressions did not consult reserved-corpus material.

Thirty new external calls were made (18 development + 12 reserved), all sequential and bounded. All subsequent runs use cache; the old competition's 48 requests were not repeated. API latency includes transport; local time covers decompilation, while worker peak RSS also includes diagnostic extraction. No fair comparative throughput claim is made. Structural counts and normalized-token similarities are lexical proxies, not scope or readability proofs.

SHA256SUMS covers the published artifacts. To restore responses for an offline rerun, extract the archive and copy each `*.response.json` under its `requestSha256 + '.json'` into an API cache directory; the client verifies its body hash before reuse.
