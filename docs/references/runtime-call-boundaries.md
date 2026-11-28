# Runtime callees without redundant groups

The final printer previously used `(callee)(arguments)` whenever an original
CALL needed a boundary and the lexical check found no inlineable function
literal. A computed lookup, a value returned by a call, or a written local
already stops both compiler resolvers. These cases can use the ordinary call
spelling without removing the original call or its reconstruction metadata.

This is a bounded final-AST proof in `src/print/CallBoundaries.ts`. It admits
computed indexes and call/method-call results; immutable callable aliases to
those results; written local bindings; and property reads from runtime object
results or written object bindings. It preserves callee evaluation exactly
once, before the arguments, with the same scalar callee and argument/result
packs. It adds no frame, closure, table, assignment or read. Existing variadic
literal handling and explicit identity-recovery calls keep their own paths.

All global targets and possible builtin-library aliases retain their groups.
Fixed-arity parameters, including immutable aliases to them, are not admitted
as runtime evidence. A function literal or a field of a local table literal
retains its stronger boundary. Ambiguous identifier-node bindings, cycles,
and the alias-work limit fail closed. This implementation uses no builtin
name list, corpus identifier, source lookup, new option, or changed default.

## Compiler and VM evidence

The inspected official revisions are
[`9d7748a4`](https://github.com/luau-lang/luau/tree/9d7748a4f324213a18cb8283fa2a77c330225fa0)
and
[`c87565b8`](https://github.com/luau-lang/luau/tree/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f).
At both pins:

- `Compiler/src/Compiler.cpp::getFunctionExpr` follows immutable local
  initializers, groups and some literal-table fields. It stops at call results
  and `AstExprIndexExpr`. It rejects written bindings.
- `Compiler/src/Builtins.cpp::getBuiltin` follows immutable local initializers
  and recognizes a property of a global library or a local initialized with
  that global (`global or fallback` is also recognized). It stops at call
  results and computed indexes and rejects written bindings.
- `Ast/src/Parser.cpp::parseIndexExpr` retains bracket indexing as
  `AstExprIndexExpr`, including a constant string index. The printer retains
  the index spelling; it does not convert this proof into a dot lookup.
- `compileInlinedCall` can replace a parameter's initializer with its call-site
  argument and rerun builtin analysis. A parameter that is dynamic in its own
  function is therefore insufficient proof for removing a callee group.
- `VM/src/lvmexecute.cpp`, `LOP_CALL` and `LOP_FASTCALL`, establishes why callee,
  open argument/result counts, call frames and metacalls must remain intact.

Tovek
[`ce2ea332`](https://github.com/Kiet1308/Tovek/tree/ce2ea3325547fa3896f274b68013386338039040),
`ast/src/deinline_safety.rs` and `ast/src/closure_identity.rs`, was inspected
for its frame, environment, capture and argument-snapshot invariants. Tovek
and official Luau are MIT licensed. The TypeScript implementation here is
independent; no implementation source was copied or adapted from either.

## Independent observations and limits

The project-authored sources are in
[`tests/fixtures/runtime-call-boundaries`](../../tests/fixtures/runtime-call-boundaries/manifest.json).
They exercise `apply` and factories with a math builtin, its alias, a function
literal and callbacks observing `debug.info` or `getfenv`; closure identity;
written targets; `__index` and `__call`; callee/argument ordering; nil-bearing
packs; and false/nil call failures. The frame-only source has no environment
operations that would disable compiler inlining. A separate scalar-position
source forces additional inlining attempts, corroborated by saved compiler
remarks for both pins.

The initial 24 profiles passed on the published engine before this change and
on the candidate. Twelve additional scalar-position profiles then passed on
both, giving **36/36 before and 36/36 after**, across both official compiler/VM
pins and O0/O1/O2 × g1/g2. Original inputs, first observations, complete raw
traces, recovered sources and recompilation bytes are retained in the
[observation archive](../../benchmarks/results/runtime-call-boundaries-2026-11-27/README.md).
These are development controls after inspection, not blind evidence.

An exact-metric diagnostic replay of all 882 current Quick bytecodes changes
similarity from **76.92827095114995% to 76.96879834207007%**, a gain of
**0.04052739092011848 percentage points**. The geometric token-size ratio changes
from **0.9927495865084095 to 0.991644135528782**. These are small improvements;
they do not establish the user's 100% source-similarity goal. The replay itself
does not execute either program. The separate unchanged strict Quick run passes **882/882** and reproduces the
same similarity. Its actual dirty-worktree engine fingerprints are retained
in the observation archive. This change does not claim new Full or Hard tier
results.
