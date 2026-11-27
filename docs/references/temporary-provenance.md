# Temporary ownership and scalar expression lists

Temporary folding used one module-wide set of names for two different facts:
debug locals and declarations inferred from register use. A parameter named
`kind` in one function could therefore prevent `local kind = schema.kind` from
folding into an adjacent comparison in an unrelated function. The spelling did
not identify the same lexical binding.

## Evidence and implementation

Luau 0.747 at
[`c87565b8`](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/Compiler.cpp)
was inspected in `compileExprListTemp`, `compileStatReturn`,
`compileExprTempN`, and the `AstExprGroup` path. A scalar local always contains
one result. An unparenthesized call or vararg in the final expression-list
position can instead supply multiple results, including zero. Parentheses
preserve the local's one-result adjustment when the expression moves there.

Tovek at
[`ce2ea332`](https://github.com/Kiet1308/Tovek/tree/ce2ea3325547fa3896f274b68013386338039040),
MIT, was consulted in
[`evaluation_order.rs`](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/evaluation_order.rs)
and
[`inline_temps.rs`](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/inline_temps.rs).
The relevant principles are preserving conditional evaluation, captured-cell
writes, result selection, and potentially failing table stores. This is an
independent TypeScript implementation; no Rust implementation was copied.

Reconstructed scalar declarations now retain their prototype, producer PC,
register, and exact debug name when available. Register-derived declaration
names are also retained per prototype after speculative reconstruction finishes.
Temporary folding uses that owner's debug and inferred declaration inventory.
During normal folding, an explicit `sourceNames` API option still protects its
names unconditionally; the existing helper-argument recovery mode is unchanged.
An AST declaration without known ownership keeps the conservative module-wide
fallback. Exact debug declarations remain protected even after their spelling
has changed. Naming inference keeps its existing global protection; this change
only refines the folding decision.

A single-use, uncaptured, unwritten temporary with a bytecode producer can also
fold into a list tail when its consumer evaluates only inert expressions before
the read. A call, method call or vararg is parenthesized in that position. Return
tuples, call arguments, table list fields, assignments and iterator lists keep
their original scalar arity. Existing open packs remain open. Unknown AST locals
retain the previous declaration policy for these additional folding positions.

No expression moves across an earlier call, metamethod, conditional arm, loop
evaluation or mutable captured read. A table field with an unproven key also
blocks motion past its store: even a private constructor can fail on a nil or
NaN key before evaluating a later field.

## Dead definitions in a guard prelude

An independent control found an existing O2 reconstruction defect. The compiler
inlined a call whose first field read had an unused result, then reused that
register for the boolean result of a second call. The original bytecode retained
the first `GETTABLEKS`, and its `__index` effect was observable. Normalization
retained it too, but `walkGuardBlock` captured it as a candidate selected value.
Both boolean arms replaced that value, so the read disappeared from source.

The guard walk now captures a destination definition only if that definition has
uses. An unused definition follows the ordinary prelude path, which preserves
its evaluation at its original location. Live comparison operands still enter
the existing value path, so their reads are not duplicated. The first failing
before/after report and exact trace difference are retained in the benchmark
evidence; the authored source and its original bytecodes were not changed.

## Verification

The authored sources and 48 sealed normal/Hard inputs are in
[`tests/fixtures/temporary-provenance`](../../tests/fixtures/temporary-provenance).
They cover independent prototype names, ordered `__index` calls, mutable
captures, a changed call receiver, short-circuit evaluation, constructor
failure, scalar zero/one/many results, nil holes, method calls and varargs.

The unit controls additionally check explicit API protection, unknown-origin
fallback, all list-tail contexts, original open packs, and all four optimized
normal/Hard variants of the previously lost field read. Runtime comparisons use
the exact original bytecode for each optimization/obfuscation profile.
