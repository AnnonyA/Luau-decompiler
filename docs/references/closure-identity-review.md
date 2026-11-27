# Closure identity: measured repair and remaining limits

Integration base: `876bf03e99b7ab6e8726a57b5e56a0cf66d72eca`.
The remote main branch still named that commit when inspected on 2026-11-27;
the GitHub open-PR API returned an empty list. The existing capture/scope fixes
through that commit are retained. This work is independently implemented in
TypeScript; no Tovek implementation was copied.

**This is a bounded repair, not general closure-cache emulation.** The original
66 profiles and 18 single-load controls match after the repair. The independent
holdouts exposed additional failures. Their first observations remain sealed;
one is subsequently repaired, and the environment-mutation example remains a
visible failing regression. The API now emits identity-specific diagnostics
where an entry assumption is used or a repeated constant remains unresolved.

## Rule from the pinned implementation

All official links below name Luau
`9d7748a4f324213a18cb8283fa2a77c330225fa0`:

| Stage | Evidence | Consequence |
| --- | --- | --- |
| Compiler | [Compiler.cpp 1659–1691](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/Compiler.cpp#L1659-L1691) | `shouldShareClosure` uses immutability and lexical-origin heuristics; it does not establish unconditional runtime identity. |
| Capture selection | [Compiler.cpp 1712–1741](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/Compiler.cpp#L1712-L1741) | VAL copies a value, REF captures a cell, UPVAL forwards an existing upvalue payload. |
| Opcode selection | [Compiler.cpp 1744–1768](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/Compiler.cpp#L1744-L1768) | O1/O2 can emit DUPCLOSURE; a written private capture forces NEWCLOSURE. |
| Loader | [lvmload.cpp 620–626](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lvmload.cpp#L620-L626) | Each owner-prototype constant slot gets its own closure and loader environment. Two slots referring to the same child are distinct. |
| Fresh creation | [lvmexecute.cpp 877–918](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lvmexecute.cpp#L877-L918) | NEWCLOSURE allocates on every evaluation; the destination exists before self captures are read. |
| Conditional reuse | [lvmexecute.cpp 2892–2946](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lvmexecute.cpp#L2892-L2946) | DUPCLOSURE reuses K only when its environment matches and its initialized captures compare raw-equal; otherwise it clones. A clone does not replace K. A capture mismatch restarts capture filling after replacing the destination. |
| Raw comparison | [lobject.cpp 36–83](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lobject.cpp#L36-L83) | Object identity is not structural equality; numeric/vector NaN is not reflexive. Source `==` on arbitrary objects is not a substitute for raw capture comparison. |

The cache key is `(loaded module instance, owner prototype, K)`, not child
prototype, instruction PC, function text, or factory activation. For captures
`1, 2, 2, 1`, the first and fourth can reuse the first closure while the two
middle evaluations allocate separate clones. The permanent C++ control runner
calls `luau_load` once, then invokes that same loaded chunk four times; loading
again on every call would erase precisely this distinction.

Tovek reference: [closure_identity.rs at 77edf387](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/ast/src/closure_identity.rs).
Its owner/constant key and first-cache mismatch invariant informed this review.
Its MIT license was inspected; this implementation uses our decoded bytecode,
CFG and SSA rather than adapting its Rust AST passes.

## First loss and repair location

The decoder retains DUPCLOSURE's owner, K and captures. SSA retains the original
instruction, but each load has a distinct definition. The loss happens in
`SourceBuilder`: a repeated load which `indexSharedClosureConstants` cannot
prove equivalent becomes another unannotated function expression in
`emitClosure`. The pre-cleanup AST already has independent literals. Cleanup
is not the first loss for these six historical examples. The evidence bundle
contains decoded instructions, SSA, reconstructed/pre-cleanup/final ASTs, exact
printed source and recompiled bytecode for base and patched engines.

| O2 case | Original fact | Repair |
| --- | --- | --- |
| 01 | Main P3: PC3 and PC17 load K1; PC6 and PC24 load K2. All four `pick` evaluations were inlined. | A closed effect proof allows the intervening calls to known arithmetic closures with numeric arguments; the two owner/K pairs retain their bindings. |
| 05 | An inlined child and the child in the retained factory have different owner pools. | Resolve an unchanged function stored in a private table; keep owner keys distinct while sharing only the repeated main constant. |
| 17 | P4 K1 first captures K0; subsequent captures from K2 must always miss. | Bounded prefix analysis follows known calls/branches/numeric loops and records first captures. A proven mismatch gets a private VAL snapshot assigned separately, preserving fresh allocation. |
| 18 | Two SSA definitions load the same already-proved closure constant. | Canonicalize that proven object identity for capture signatures, without canonicalizing carrier results that might be clones. |
| 21 | Changing the parent environment before two capture-free loads makes both clone. | Apply the environment-prefix check even without captures; retain native DUPCLOSURE checks behind a closed carrier. |
| 22 | A new private table and writes into it do not change closure identity. | Use SSA allocation/escape evidence rather than treating every table write as a barrier. |

`ClosureCachePriming` stops at unknown inputs, calls, branches, REF cells,
unsupported instructions and bounded resource limits. It never guesses the first
runtime branch. It does not turn every observed capture tuple into a memoization
key. The first recorded tuple is never replaced. Self captures are read after
the destination and reread when a mismatch creates a clone.

`ClosureEffects` distinguishes an unescaped table from its mutable contents.
Constructor callees are rejected after writes in other CFG blocks. Numeric field
proofs inspect reaching field writes and v14 table constants; capturing a table
does not publish it if the capturing closure remains private and uncalled.
Unknown calls, escapes and possible metamethods remain barriers. These are
sufficient proofs, not a general effect analysis.

The new capture-free carrier is variadic, so official O2 does not inline it
([Compiler.cpp 649–660](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/Compiler.cpp#L649-L660)).
Its child still uses a native constant whose lifetime is the bytecode load, not
the helper activation. Case 21 verifies its CALLs and child DUPCLOSURE in the
recompiled disassembly. A carrier with synthetic captured parameters would
normally emit NEWCLOSURE when not inlined; that unsuitable design is not used.

## Regression evidence and limits

The main manifest has 84 locked bytecodes: 66 CLI v14 profiles and 18 compiler-API
v9 controls. No original is recompiled by the benchmark. Hash and version checks
precede execution. Every reconstructed source is compiled unedited. The default
gate fails on any stdout/stderr/exit mismatch, compilation failure or runtime
failure. It does not contact an external service.

Two independent variants were sealed before candidate `8ff6964` was evaluated.
The first candidate matched 6/9 executions; all three failures were O2.
`h02` subsequently became a development regression: both branches mutate a
numeric field of the same captured table and must preserve closure identity.
`h01` remains unresolved: it changes the cached closure's environment, obtains
two distinct clones, restores the environment and must recover the original
object. Its recompiled direct callback call also gets inlined into the parent's
environment, losing the detached value. The optional adversarial benchmark
returns a failing exit status for this remaining failure; it is not an expected
success or a skipped assertion.

Other executed limits in the accompanying evidence are an unknown first branch,
a table callee overwritten conditionally, and a host that changes main's
environment between activations. An inert prefix inside main does not prove
that its environment equals the loader environment on every activation.
`closure-identity-entry-assumption` exposes that contract; unresolved multiple
loads emit `closure-identity-unresolved`. Neither diagnostic is an equivalence
claim. In particular, 84/84 does not establish arbitrary host-context fidelity.

Luacid v0.2.16 was queried with the authorized original synthetic bytes: 64
unique requests covered the 84 rows. Exact returned source, including optimize
pragmas, was preserved. It matched 61/66 main profiles and all 18 controls.
Tovek's pinned comparable main evidence matched 63/66. On this matrix our repair
matches the five Luacid divergences (05,16,17,18,21) and the three Tovek
divergences (17,18,21). Luacid matched both independent holdouts, including h01
which remains a counterexample to our repair. No general competitive advantage
is inferred from these samples.
