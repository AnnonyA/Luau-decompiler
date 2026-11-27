# Parallel declarations from debug scopes

The official compiler starts a local's debug interval after evaluating the
entire initializer list. For `local left, right = first(), second()`, the first
producer therefore runs before either name is in scope. Looking only at the
instruction immediately after that producer lost `left` and could turn the two
source locals into unrelated temporaries. The same problem affected fixed
tuples copied out of an inlined helper.

## Evidence and boundaries

This change inspected Luau 0.747 at
[`c87565b8`](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/Compiler.cpp),
specifically `compileStatLocal`, `compileExprListTemp`, `pushLocal`, and the
inlined argument/result allocation. `compileStatLocal` first emits the complete
right-hand side and then calls `pushLocal` for each destination, so equal debug
boundaries and consecutive registers provide declaration evidence.

Tovek at
[`ce2ea332`](https://github.com/Kiet1308/Tovek/tree/ce2ea3325547fa3896f274b68013386338039040),
MIT, was consulted in
[`local_declarations.rs`](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/local_declarations.rs)
and
[`assign.rs`](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/assign.rs).
Its declaration insertion checks that an initializer does not read a name whose
declaration would move. The implementation here is independent TypeScript code;
no Rust implementation was copied.

`DebugDeclarations.ts` indexes these groups against the **original input
prototype**, following a unique incoming CFG chain to the last producer of each
register. A branch, ambiguous producer or repeated register rejects the proof.
Normalization keeps a weak provenance association with that prototype, and a
group member is used only when its exact producer survives by `originalPc`.
Deleted literal loads cannot transfer their names to earlier unrelated
temporaries after debug boundaries have been remapped.

The raw AST may combine adjacent scalar initializers only when the debug group
and register order agree. Evaluation order is unchanged, the number of
destinations still clips each initializer to one value, and every initializer
must be free of reads or captures of all names being combined. No declarations
or expressions move across another statement. An adjacent complete scalar copy
of a fixed tuple may give its producer the source names directly only if every
old slot has exactly that one reader, no writes and no captures. Partial tuples,
other readers and captured temporary cells retain their existing bindings.

This does not reconstruct source locals removed by the input compiler, recover
arbitrary `do` scopes, merge unrelated adjacent declarations, infer source from
the benchmark corpus, or treat physical instruction order as control flow.
Profiles without local debug metadata retain their existing reconstruction.

## Verification

The project-authored sources and sealed normal/Hard bytecodes are in
[`tests/fixtures/debug-declarations`](../../tests/fixtures/debug-declarations).
Their manifest records SHA-256 hashes and the pinned Rosetta/Luau compiler.
The cases exercise observable initializer order, nil holes and multiple returns,
lexical shadowing, captured mutable loop cells, and complete fixed-result tuples
returned by inlined helpers. The unit suite also rejects a capture of an earlier
declaration and incomplete or externally observed tuple copies.

An initial development candidate exposed two quality regressions: it duplicated
the temporary and source tuples in a wide function, and it associated deleted
debug loads with surviving earlier producers. The final proofs above address
both; the register-pressure gate remains unchanged.
