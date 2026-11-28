# Deferred consumer review regression

An independent review of `51de2ab695821536cf70724e60bf1b12652f9e61`
constructed an AST where a complete private loop was followed by a closure
returning `0 / 0`. The helper's return had the same expression. The old result
search entered the closure body, inserted a recovered result local, and made
the closure capture its NaN value. `factory() == factory()` consequently
changed from `true` to `false` at O1 and O2.

This control invokes `recoverPrimitiveRegions` on authored AST with explicit
line evidence. It proves a pass-level semantic defect; it is not presented as
an independently compiled source that reached the defect through the entire
decompiler pipeline.

`before.luau`, `candidate.luau`, `first-observation.json`, and the twelve sealed
bytecodes are the initial observations. Both official pins were compiled and
executed at O0/O1/O2 with debug level 2. O0 produced `false` for both programs;
O1 and O2 produced `true` before the transform and `false` afterward, on each
pin. These files have not been replaced by repaired results.

`fixed.luau` and `fixed-observation.json` record the narrow repair: searching a
consumer stops at function expressions, function declarations and subordinate
blocks. Its recovered-helper set is empty, and its source and compiled bytes
are identical to `before.luau` at all six pin/profile combinations. The pass
also declines shared syntax nodes to avoid ambiguous lexical ownership,
liveness or replacement across those boundaries; provenance remains separate.

The focused regression tests cover deferred closures, closures in table fields,
subordinate blocks, shared identifier/result nodes, shared provenance, and the
immediate local/assignment/return/call consumers that remain supported. The
four previously improved Quick outputs are byte-identical after the repair.
No full benchmark tier is inferred from these targeted checks.
