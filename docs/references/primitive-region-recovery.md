# Recovery of private primitive regions

This bounded recovery was implemented independently on base
`36a344eeed74d194723e6f32a0ef7d699fac550f`. It restores calls to retained local
helpers when an entire copied computation can be matched and proved safe. It
does not depend on the reconstructed call being inlined, add an optimization
directive, or change an option default.

## Proof and supported shape

The existing bytecode line-overlap census admits a retained helper. It does not
prove a call site: `PrimitiveRegions.ts` separately matches complete AST blocks
by resolved lexical binding identity. Local spellings are irrelevant. While,
repeat, numeric-for and bounded native-table generic-for regions preserve their
conditions, bodies, branch order, break/continue targets and statements.
Missing arguments, partially folded regions and competing helpers decline.

A monotone fixed point over every local initializer and writer proves possible
value types. Every writer is checked again after convergence; unresolved cycles
and an exhausted work budget decline. Arithmetic requires numbers, ordered
comparison requires two numbers or two strings, and equality/truthiness use
known primitive values. No callbacks, global/environment reads, property/index
accesses, closures, external writes, variadic helpers or open return packs enter
the proof. Printed annotations are not type evidence.

One argument may be a fresh array literal of at most 64 primitive entries. It
has no metatable, named/computed keys, aliases, effectful field expressions or
escaping table value. Its generic-for variables are proved numeric keys and
primitive element values. Only leading literal local declarations may precede
that loop; allocation is not moved across another loop or operation that can
observe it. Repeated uses of a constructor argument are rejected, including
when an AST happens to share a constructor node. This is not a general proof
that a table-valued local is private.

All returns of the retained helper are a fixed tuple of one to four primitive
values. The recovered call initializes one local, preserving the original
one-value adjustment even if the helper returns a tuple containing nil holes.
For a conditional result expression, a private scalar is produced at the old
region position; the computation is not delayed into an effectful consumer's
argument list. Other copied scratch bindings may have no reads or writes
outside the consumed region/result expression. Captured scratch cells decline.
The consumer search stops at function bodies and subordinate statement blocks;
it never moves a deferred result into a new captured temporary. Syntax nodes
shared between occurrences make this pass decline, since its matching,
liveness and replacements require unambiguous node ownership. Shared provenance
and annotation arrays do not trigger that restriction.

Within a nested function, an inherited helper must already be an upvalue of
that function. Its stable binding remains visible at the replacement position.
The pass neither adds a new helper capture nor substitutes a different captured
cell. Newly called helper bodies cannot observe the additional frame: their
operations are primitive, and the one supported table iteration cannot invoke
`__iter` or an element/needle metamethod. The proof does not rely on an absence
of a particular `debug.info` spelling elsewhere in the module.

The conservative register check includes all bindings, hidden loop controls,
wide packs, table constructors and nested expression temporaries. It declines
above 180, leaving room for a new call window of at most eight arguments and
its callee/result. A control with 100 parameters, 64 array fields and nested
operands ensures that counting bindings alone is insufficient. Template size,
expression depth and total matching work have independent bounds.

## References inspected

Tovek at
[`ce2ea3325547fa3896f274b68013386338039040`](https://github.com/Kiet1308/Tovek/tree/ce2ea3325547fa3896f274b68013386338039040)
was consulted for the separation of line evidence from exact unification,
loop-region liveness and frame/capture checks:

- [`ast/src/deinline/evidence.rs`](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/deinline/evidence.rs)
- [`ast/src/deinline.rs`](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/deinline.rs), `match_value_loop` and `match_own_local_loop`
- [`ast/src/deinline_safety.rs`](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/deinline_safety.rs)

Its `LICENSE.txt` is MIT, copyright Jujhar Singh and Mathias Pedersen (2024).
No implementation code was copied or adapted. The TypeScript region matcher
and primitive fixed-point proof are independent and deliberately support a
smaller class than Tovek's de-inlining passes.

Official Luau references were inspected at both the CI pin
[`9d7748a4f324213a18cb8283fa2a77c330225fa0`](https://github.com/luau-lang/luau/tree/9d7748a4f324213a18cb8283fa2a77c330225fa0)
and Rosetta's 0.747 pin
[`c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`](https://github.com/luau-lang/luau/tree/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f):
`Compiler/src/Compiler.cpp` (`tryCompileInlinedCall`, `compileInlineReturn`,
`compileStatReturn`), `VM/src/lvmexecute.cpp` (numeric and generic iteration),
and `VM/src/lnumutils.h` (primitive numeric operations). A fixed return request
is different from a forwarded pack; restoring one scalar call must retain that
distinction. Numeric loop conditions and updates are matched without algebraic
reassociation or a change to their NaN behavior.

## Validation and measured limits

The authored fixture records scalar/tuple/nil-hole results, metamethod frame
observations, an opaque iterator, captured cells and external state at six
normal and six Hard profiles. Baseline and candidate both pass all 12. The
unchanged copied Quick sources pass 1,764 normal/Hard regression round trips.
Sealed fixture bytecode and hashes protect all 12 profiles. Focused unit tests
also reject ambiguous helpers, empty/mixed/nil-bearing arrays where unsafe,
shadowed or changed callees, open results, escaping scratch cells and register
pressure. Full validation counts and hashes are in the
[measurement record](../../benchmarks/results/primitive-regions-2026-11-27/validation.json).

With the unchanged Rosetta scorer and default options, Quick similarity moves
from **76.9282709511% to 76.9446880098%**, a **0.0164170587 percentage-point**
gain. Four of 882 outputs change; the other 878 remain identical. In those
profiles, `control_flow` gains about 2.586 points and `loops` about 4.65 points.
These examples diagnose coverage; their sources and identifiers are never
inputs to the engine. The complete compact comparison is
[archived here](../../benchmarks/results/primitive-regions-2026-11-27/quality-comparison.json).

The gain is small in the global mean. This pass does not solve the larger
regions involving property access, callbacks or new capture arrangements in
`remaining-inline-recovery.md`, nor establish the 82.2%, 90% or 100% targets.
Four-tier strict release measurements belong to the combined final candidate;
the 1,764-profile source regression is not labeled as that release benchmark.

A subsequent independent review found that searching a consumer's nested
closure could replace its constant NaN return with a new upvalue, changing
closure sharing. The initial failing transformation, both compiler pins and
the repaired output are preserved in the
[deferred-consumer archive](../../benchmarks/results/primitive-regions-2026-11-27/deferred-consumer/README.md).
This is an authored AST transformation regression, not a claimed end-to-end
bytecode failure. The repair preserves the four previously improved Quick
outputs exactly; its focused checks do not replace the final combined suites.
