# Conditional inlining recovery — 2026-10-28

Compared with `71203a3bf7f9ef0d4c7cdc3be25082da61530ca8` (PR #64), the engine
recovers conditional helper calls, immutable numeric dependency chains and stable
numeric captures. It rejects ambiguous helpers and checks extracted argument
bindings against the lexical scope at the replacement site.

Examples from identical official O2 bytecode are under [examples](examples):

| Program | Improvement / protected behavior |
|---|---|
| inlined-conditional-returns | `band(index)`, `shifted(index)` and `inside(index)` replace conditional copies; helper definitions stay intact. |
| inlined-conditional-captures | `weighted(j)` is recovered inside a nested loop; saved per-iteration closures and mutated captured cells retain their behavior. |
| inlined-conditional-effects | Primitive loop calls can be recovered; unknown boxed arguments keep their metamethod invocation order and return arity. |
| inlined-alias-shadowing | Arguments inferred from old initializers retain their bindings across shadowing blocks, loops and parallel declarations. |

Each example includes before/after source, official O2 disassembly, raw AST before
cleanup, final AST and per-prototype CFG/SSA. [examples.json](examples.json) records
bytecode and output hashes. The original source and O0/O1/O2 bytes are in
`tests/fixtures/object-optimized`. The analysis uses the existing
`reconstructFunction` / `analyzePrototype` APIs; maps are serialized as entries.

Validation: **459 unit tests**, **46 harness tests**, **765/765 style/optimization
profiles over 1,050 input executions**, historical **200/200**, **24/24**, **36/36**,
both large cohorts **30/30**, subsequent observed independent regressions **9/9**,
and seeded fuzzing **90/90**. The official parser and VM validate the source and
traces; the Chromium demo passes. [validation.json](validation.json) records report
hashes and [new-fixture-traces.json](new-fixture-traces.json) preserves all 60 new
style/profile results (180 input executions).

Review exposed a scope error: extracting an old initializer could bind an argument
to a later shadowing declaration (7 became 205). The destination binding check
fixes it, with unit regressions for block, same-block, loop and iterator shadows,
and a positive test for parallel-local initializer scope. Two candidate helpers
also now cause refusal, including when the ambiguity scan exhausts its budget.
The initial new metamethod test used an invalid table-versus-number comparison;
it was corrected to exercise numeric multiplication metamethods before the new
fixture bytes were finalized. No existing sealed fixture or assertion changed.

The [reference study](../../../docs/references/tovek-conditional-recovery.md)
links all five requested Tovek files and the official Luau compiler/VM revision,
explains the independent implementation and lists unsupported cases. This pass
consumes reconstructed CFG/SSA results; no CFG/SSA or closure-cache algorithm is
claimed as rewritten in this round. These are development regressions, not new
blind evaluations. No competitor API requests were made or competitive advantage
measured.
