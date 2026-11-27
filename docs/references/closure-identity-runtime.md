# Native closure identity and recompilation boundaries

This follow-up removes the four measured limitations of the first closure
identity repair without introducing an activation-local memo table. The
permanent aggregate is `benchmarks/closure-identity/complete-manifest.json`;
the original manifests and bytecodes remain unchanged. Additional independent
programs are admitted only after their first frozen-candidate observation.

## The VM owns the decision

The reference is Luau
[`9d7748a4f324213a18cb8283fa2a77c330225fa0`](https://github.com/luau-lang/luau/tree/9d7748a4f324213a18cb8283fa2a77c330225fa0).
A closure constant belongs to a loaded module, an owner prototype and a K slot.
Two owners referring to the same child do not share that slot. NEWCLOSURE
allocates a new closure. DUPCLOSURE first compares the constant's environment
with the executing owner's environment, then compares captured values with
raw equality. A clone does not replace K. An environment miss before the first
compatible load leaves the preloaded K uninitialized: it is not a cache of the
first arbitrary evaluation.

The authority is
[loader constant creation](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lvmload.cpp#L620-L626),
[NEWCLOSURE](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lvmexecute.cpp#L877-L918), and
[DUPCLOSURE](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lvmexecute.cpp#L2892-L2946).
No emitted Lua equality guard substitutes for these operations, so table
metamethods, NaN and changes to the cached function's environment are not
approximated by a source-level memo table.

## Three complementary transformations

**Keep original CALL boundaries.** O2 can inline a reconstructed local function
that the original compiler left as CALL. That can move global reads into the
caller's environment or convert NEW into DUP after cleanup reduces register
pressure. The call's provenance survives AST passes. The printer uses
`(if true then callee else nil)(arguments)` where a boundary is required. In the
pinned compiler,
[`getFunctionExpr`](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/Compiler.cpp#L353-L379)
does not traverse an if-expression. The callee is evaluated once, before its
arguments, and adjusted to one value. This fence adds no table allocation,
changes no function parameters and makes no captured binding writable. Its
purpose is mandatory fidelity, separate from optional pretty-print rewrites.

**Repeat the native constant load instead of aliasing its first result.** A
variadic carrier prevents O2 from inlining away its native constant. Its child
captures the original lexical bindings, without passing them as parameters.
This also matters for a readonly top-level table: a later host activation can
have the same environment but a different captured table. A neutral entry
prefix does not prove either runtime equality. The carrier is valid only when
intervening instructions cannot change the owner's environment, and the capture
bindings remain in scope. Captured carriers with unproved cross-block placement
remain excluded.

For capture-free groups with environment changes between loads, a bounded
dispatcher instead unifies repeated loads into one physical literal inside the
same owner. The original statements run in their original order. Each K retains
its own literal. Hoisted locals must be uncaptured and unambiguous, and
break/continue must retain their original loop targets. This is checked in
`ClosureIdentityLowering.ts`; an unproved region keeps an explicit diagnostic.

**Recover an evidenced small factory for variable captures.**
`ClosureInlineRecovery.ts` recognizes retained opcode lineage, not debug names
or fixture names. A complete owner/K group can recover either a small parameter
factory or an adjacent closed H/W pair. For the pair, both constant pools are
recovered together and H must have no external reads. For parameters, arguments
must retain direct unwritten function-literal initializers in the same owner.
An alias holding the same object is insufficient for the compiler's heuristic.
The generated calls have one fixed result. Native K remains responsible for
first-capture initialization and later mismatches across activations.

This last transformation emits **`--!optimize 2`** and an explicit diagnostic.
Its contract is the pinned official compiler with its default inline limits:
nonvariadic helper, no direct getfenv/setfenv module flag, bounded register
pressure and inline depth, and a small literal-return body. The original
owners retain their CALL boundaries. The implementation counts nested binary
temporaries and call windows before callee evaluation; an earlier pack-only
estimate was refuted by an executed R161..R163 example. The relevant compiler
rules are
[inline gates](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/Compiler.cpp#L941-L1033),
[initializer propagation](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/Compiler.cpp#L1220-L1265), and
[sharing/captures](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/Compiler.cpp#L1659-L1768).
This is not a claim about arbitrary compiler revisions or modified fast flags.

## Closure creation is time-sensitive

A literal reads its creating environment even when it has no lexical captures.
Moving it past a call can change behavior. Required capture initializers remain
pinned throughout presentation and cleanup. Other single-use closure moves
require an immediate consumer and an evaluation-order proof for the expressions
before the use. Bytecode operand provenance records when the receiver and
earlier arguments were prepared. In the pinned compiler, a colon call evaluates
the receiver before its arguments, then performs NAMECALL after the arguments;
a dot call evaluates the method lookup first. Those orders must remain distinct
([receiver, arguments and NAMECALL emission](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/Compiler.cpp#L1524-L1590)).
A generic assumption that function literals are inert is not enough.

## First independent observation and runtime arguments

The first frozen local snapshot, `e26040ae485b6e45eb7fa1b301903e3017c81fd7`,
matched all 98 previously observed profiles and 16 of 18 newly sealed profiles.
Both new failures were O2 versions of `r2h02_cache_environment_pairs` (v9/API and
v14/CLI). Luacid's unedited cached sources failed the same two profiles. Their
first observations remain in `benchmarks/closure-identity/independent-round2`;
later checks of these programs are development regressions.

The two DUP loads retain the same owner/K and the same SSA vararg capture all
the way through decoding. The first rejection was in
`constantCaptureSignature`: it still demanded static raw reflexivity, a condition
from the former direct-alias optimization. A native carrier does its own VM
comparison, so a main argument need not have a statically known value or even be
raw-equal to itself. Main GETVARARGS values remain runtime lexical captures in
the source and are now admitted. This does not admit arbitrary unknown
producers: literal NaNs that could lose their capture through folding, uncertain
parent cells, and unsupported placement keep the existing exclusions. No Lua
equality guard or parameter-based replacement of the capture is introduced.

The regression suite includes changing/restoring a cached closure's environment,
host A/B/A entry environments with one load, owner environment changes between
loads, unknown first captures, conditional table callees, an original factory
that O2 refuses to inline under register pressure, and initializer movement
across environment changes. The tests preserve equality, table-key behavior,
captured state, call order and multiple-result arity.

## Bytecode is the oracle

`bench-semantic` now executes the exact bytes passed to the decompiler and the
exact recompilation. Running a source file again with the interpreter's default
optimization is not an O0 oracle. CI builds `scripts/closure-identity/run_bytecode.cpp`
against the pinned VM and supplies `--bytecode-runner` explicitly. A harness
regression mutates the source after compilation to verify that the original
observation still comes from saved bytes. Header directives and v9/API versus
v14/CLI output remain visible in the closure benchmark's receipts.

Tovek `77edf387bf280a2f4d46d57ac85d5c4f071b763f` remains an engineering reference
for closure-identity boundaries (`ast/src/closure_identity.rs`); its conservative
capture handling is not a general runtime cache implementation. This TypeScript
implementation is independent, with no copied Rust implementation. Competitor
results remain measured, per-profile evidence rather than claims of general
superiority.
