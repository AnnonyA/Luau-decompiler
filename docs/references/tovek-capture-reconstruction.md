# Captures after SSA reconstruction

Reference inspected: [Kiet1308/Tovek at 77edf387](https://github.com/Kiet1308/Tovek/tree/77edf387bf280a2f4d46d57ac85d5c4f071b763f), MIT license, copyright Jujhar Singh and Mathias Pedersen (2024).

The useful invariant is that a pinned local is not necessarily immutable. Luau's
VAL capture snapshots a value, while reconstructed Luau closures capture lexical
cells. Reusing an SSA phi binding across iterations can silently change one into
the other. The independent workbook benchmark exposed precisely that problem:
all saved checkpoints returned the last iteration's score.

Tovek retains `Upvalue::Copy` separately from `Upvalue::Ref`, then restores needed
snapshots after SSA destruction:

- [capture classification in lifter.rs](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/luau-lifter/src/lifter.rs#L1750)
- [materialize_value_captures.rs](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/ast/src/materialize_value_captures.rs)
- [copy_cleanup.rs safeguards](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/ast/src/copy_cleanup.rs#L224)

Our implementation uses the existing decoded capture tags and phi ownership at
closure emission. It creates a local snapshot for VAL captures of merged or
mutable forward bindings, keeps it separate from the register environment, and
routes only VAL captures through it. REF captures continue using their original
cell. Deferred expressions are materialized once. No Rust source was copied;
this is an independent implementation of the invariant in our TypeScript IR.

The workbook's O1/O2 regressions failed before this change and pass afterward.
Its first independent evaluation remains stored separately; using it to develop
this fix makes subsequent evaluations development regressions.

Other promising Tovek work, not claimed as implemented here: general de-inlining
of O2 helpers, a full capture-effect graph, and structured fallback for arbitrary
irreducible CFGs. These require their own evidence and regression work.

## Shared closure constants after O2 inlining

[closure_identity.rs](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/ast/src/closure_identity.rs)
tracks `(prototype, constant slot)`, rather than assuming identical function
bodies imply identical objects. Official Luau `lvmload.cpp` creates a closure
per constant, and `lvmexecute.cpp`'s DUPCLOSURE reuses it when environment and
captured values agree.

Our additional independent reduction calls a factory twice. O2 emits two loads
of one capture-free closure constant; formerly we printed two function literals,
changing `first == second` from true to false. We now share one lexical binding
for repeated capture-free constant loads in the same basic block, with only
inert loads/copies between them. Creation remains at the first original site.
Register assignment still uses the normal phi/REF path. This does not merge
NEWCLOSURE, different constant slots, captured closures, cross-block loads or
loads separated by potentially effectful instructions. General environment- and
capture-sensitive cache reconstruction remains future work.


## Constant sharing across dominated regions

The follow-up retains creation at the first original load but extends identity
recovery beyond one straight block. A load may reuse the first binding when it
is dominated by that first load, all intervening instructions are inert loads,
copies or truthiness branches, and no participating load is in a loop. A local
slot declared in the enclosing function keeps the binding visible across branches;
only its declaration moves, not closure creation or capture evaluation.

SSA now records the reaching definition at each register read. VAL capture lists
are compared by those identities, following MOVE aliases, and require positive
evidence that the captured value is raw-equal to itself. Reusing a register with
a new definition does not count as the same capture. Captured sharing is restricted
to non-repeating top-level regions of the chunk: a nested function can execute
again with different captures while its prototype constant still caches the first
activation's values. REF/UPVAL captures, self captures and uncertain activation
lifetimes remain excluded. This is not general captured-closure cache emulation.

Project-authored `stable-capture-constant` and `branch-closure-constant` failed
identity comparisons at O2 before the change; both now match at O0/O1/O2. The
former also verifies table alias identity, mutation visibility and multiple
returns. The latter runs with both truthiness outcomes. `different-closure-captures`
and a synthetic SSA-version test protect against merging distinct captures.
The same Tovek `closure_identity.rs` and official VM DUPCLOSURE implementation
listed above informed the invariant; the implementation is independent.

Cycle exclusion uses iterative strongly connected components, not only natural
loops: irreducible regions can revisit a load despite having no dominating loop
header. The graph walk is linear in blocks and edges and does not recurse on
the host stack.

### Review regressions

The official VM's `luaO_rawequalObj` rejects numeric and vector NaNs even when
the two captures use the same SSA definition. Only known reflexive captures
(such as table identities or non-NaN constants) qualify. Unknown values fail
closed. We do not emit `value == value` guards: Luau can invoke `__eq` even for
the same table or userdata, introducing an extra effect.

New captured/cross-block sharing also proves that every path before the first
load contains only environment-neutral instructions in the main chunk. An
earlier `_G.setfenv(1, ...)` can force every DUPCLOSURE to clone, even when its
captures agree. Nested activation environments are not assumed to match the
constant's original environment.

Between loads, a predecessor walk checks the actual CFG paths back to the
dominating load. An acyclic detour may execute a call with a PC after both
loads, so checking only a numeric PC interval is insufficient. A synthetic
regression changes the first function's environment on precisely this detour;
the two returned functions must remain distinct.

The earlier capture-free, same-block rule is preserved, including after a call
and inside a nested function, with two permanent runtime fixtures. Its general
environment-sensitive and cross-activation cache emulation remains a preexisting
limitation; these stronger proofs govern the newly supported regions. The new
NaN and environment fixtures are development regressions, not blind evaluations.

## Fixed tuples and optional rewrites (2026-11-06)

This round consulted the same pinned Tovek revision `77edf387`:
`ast/src/expr_deinline.rs` (fixed arity and variadic rejection) and
`ast/src/deinline_safety.rs` (whole-binding writer checks). Official Luau
`9d7748a4` `Compiler/src/Compiler.cpp` `compileInlineReturn` / `compileExprListTemp`
explains how each call's requested result count controls inlined assignments;
`compileUnrolledFor` motivates the deliberately bounded integer-stride reroll.
`Ast/src/Parser.cpp` verifies const initializer arity. The implementations here
are independent; no competitor source was copied.

Tuple recovery matches every slot, in order, against the same proven primitive
arguments. It preserves existing lexical destinations, rejects open or clipped
packs, and refuses ambiguous matches. Existing-cell tuples use parallel assignment;
mixed tuples reserve conservative local-register headroom, including inside repeat
scopes that cannot be shortened without changing the until condition's scope.
Optional math rewrites introduce private literal bindings rather than assuming the
global math library is unchanged. Module unfolding rejects initializer references
to the newly introduced local name and any effectful or open field initializers.

The new constant-capture regression exposed a REF-specific freshness failure at
O1: dead prior stores disappeared during reconstruction, leaving an immutable
literal initializer that official `shouldShareClosure` could fold away. The
builder now records resolved REF cells and restores declaration-plus-assignment
only when the completed lexical analysis finds no surviving writes. Existing
mutations and their scopes remain intact. Tovek `closure_identity.rs` distinguishes
shared prototype constants from fresh allocations; official `shouldShareClosure`
checks the captured local's written flag. This fix does not emulate arbitrary
closure caches.

Review also exercised 105 recovered tuples inside repeat, deeply nested numeric
loops, a 254-argument call, and nested 126/127-argument calls. A conservative shared
register budget includes lexical bindings, hidden loop controls and simultaneously
live nested expression packs. Optional local-adding rewrites decline when the
budget cannot justify headroom; they leave the original statements intact.

## Guarded infinite loops and FASTCALL consumers (2026-11-06)

References remain pinned to Tovek `77edf387` and official Luau `9d7748a4`.
Tovek's `luau-lifter/src/builtins.rs` explains that the trailing CALL names the
builtin used when the standard environment fast path cannot execute. Official
`VM/src/lvmexecute.cpp`, `LOP_FASTCALL`, obtains argument/result counts from that
CALL, including open argument packs. `Compiler/src/Compiler.cpp` `compileStatWhile`
patches condition exits separately from iteration backedges.

Our source lowering already emits the fallback CALL to represent both runtime
paths. Its value-use analysis now counts that CALL and ignores the duplicate
FASTCALL operands. Previously it excluded the CALL while emitting it, treating
generic FASTCALL arguments and callee imports as dead. Discard statements could
then duplicate the same calls later embedded in expressions. Real call boundaries
also participate in preserving evaluation order.

Natural loop classification and header extraction now require an edge outside
the loop before consuming a header condition as a while exit test. A guard whose
false edge reaches the backedge remains inside `while true`, preventing an
invented break. Four independently authored reductions exercise repeated
visibility guards, variadic builtins, observable argument calls, replacement
environments and metatable-backed loop inputs. Preparation instructions consume
source bounds/iterators once; only iteration reads remain protocol-only. Counting
FORNPREP/FORGPREP inputs prevents discarded property reads from being evaluated
again in loop headers. No uploaded source or competitor implementation was copied.

## Lexical helpers and function presentation (2026-11-07)

Consulted Tovek `77edf387` `ast/src/expr_deinline.rs` for exact matches and stable
arguments, `ast/src/deinline_safety.rs` for capture/frame observations, and
`ast/src/closure_identity.rs` for shared closure constants. Official Luau
`9d7748a4` `tryCompileInlinedCall`, `compileInlineReturn`, `shouldShareClosure`,
and VM `LOP_DUPCLOSURE` establish argument/result binding and capture identity.
The implementations here are independent.

The recoverer previously cleared every helper at function boundaries. It now
inherits only a dominating stable helper that the child already captures,
including transitive captures. Parameter/self-name shadows are excluded.
Rewrites must preserve the replaced region's free bindings in their arguments;
initializer expansion cannot substitute a different captured cell. Existing
primitive-value, arity, ambiguity and work-budget restrictions remain. Helpers
calling unknown modules or metamethods are still outside this proof.

Single function assignments can use `function name(...)` only when the genuine
prototype debug name matches the destination. Anonymous or renamed expressions
keep their syntax: inventing a name changes `debug.info(..., "n")`. Forward
locals remain in place, and indexed/parallel assignments are not converted.
The demo/CLI/HTTP boundary adds export metadata while core source stays
deterministic. Closure creation also snapshots old register aliases before
overwriting a forward REF cell, matching the existing ordinary-assignment rule.

For identical captured closure constants loaded in one noncyclic main-chunk
block, a preceding unknown call prevents proving that the environment still
matches the bytecode loader's environment. Instead of aliasing the first result,
the new bounded fallback puts one closure literal behind a zero-argument factory
and materializes a factory call at each original load. `lvmload.cpp` initializes
nested constants with the load environment; the factory inherits the environment
at its declaration, and the child's DUPCLOSURE repeats the VM cache comparison.
Thus stable captures share in an unchanged environment and remain distinct after
an environment change. Captures must match the existing raw-reflexive SSA proof,
intervening instructions must be inert, and every added factory/result local
counts toward a conservative register budget. No environment API is injected.

## Source structure and Tovek V2.7 (2026-11-07)

Consulted the newer Tovek revision
`a70720174f61028af9e38e8f6761d18c422c0bc7` (README identifies V2.7;
`LICENSE.txt` remains MIT). Relevant files: `ast/src/inline_temps.rs`, especially
`forwards_table_into_prefix`, and `ast/src/rebuild_table_literals.rs`, including
private-constructor, captured-binding, field-order and table-layout restrictions.
The benchmark corpus remains pinned to `77edf387`; fetching the reference did
not replace its samples or reference bytes. No implementation code was copied.

Our owned-table pass can now embed named child records in a parent constructor,
provided there is one noncaptured use and every local-valued field has an
immutable, still-visible lexical binding. Properties, calls, mutable snapshots,
invalid computed keys and receiver/assignment-target uses are retained. This is
a bounded structural recovery, not Tovek's entire allocation reconstruction.

Official Luau `9d7748a4` `Compiler.cpp` `compileStatIf` / `compileStatRepeat`
motivates the function-tail scope restriction on early-return flattening. The
compiler's method-call lowering evaluates receiver, arguments and then NAMECALL;
adjacent single-use receiver folding preserves those evaluation points. A local
returned immediately can be removed with explicit scalar parentheses for calls
and varargs. Repeat-body analyses now include the until expression in the same
scope, including closure captures and any rewritten binding references.

The printer adds whitespace without sorting statements and expands nested
records without reordering keys. Existing exact-output tests were updated to
assert the intended folded returns/blank lines, retaining effect, scope, const
and arity checks. New official-runtime fixtures exercise the changes together.

## Return structure and getter result names (2026-11-07)

Consulted Tovek V2.7 `a70720174f61028af9e38e8f6761d18c422c0bc7`
`ast/src/refine_names.rs`, including its `FunctionRoles`/`ReturnRole` distinction
between resolved bindings and explicit result positions. Our independent,
bounded rule uses an enclosing named getter/factory's stem only for a generated
local table returned as a single explicit value in that function. It does not
rename outer captured tables, parameters, multiple result positions or genuine
source names. Existing lexical allocation still prevents global/capture clashes.
This is a naming hint, not a claim of recovering the original spelling or Tovek's
full interprocedural inference.

Official Luau `9d7748a4` `compileExprIfElse` selects one scalar expression whereas
`compileStatReturn` may forward a complete result pack. The final structural
pass therefore reuses the existing scalar-only return rule after scratch cleanup
has exposed return arms. Calls adjusted by locals keep their parentheses;
unadjusted calls and varargs retain statement returns. Only return structure is
revisited, with no second naming pass or movement of initialization/effects.

Review and official execution exposed two function-name hazards: inferred table
names could displace a later function declaration, and compact/PascalCase styling
changed prototype debug names. Inference now reserves explicit and function
bindings before allocation, rejecting suggestions without consuming them.
Styling preserves local and forward function declaration names and function
expression initializer names, while still styling parameters and other locals.
Qualified method names keep their public tail as before. `getter-debug-names`
records the observable `debug.info(fn, "n")` contract across all naming styles.

## Field roles through literal fallbacks (2026-11-08)

Consulted Tovek V2.7 `a70720174f61028af9e38e8f6761d18c422c0bc7`
`ast/src/refine_names.rs` (`field_role` and bounded fallback-role evidence), plus
official Luau `9d7748a4` `compileExprAndOr`. Our independent naming rule recognizes
`record.Field or <literal>` and `record and record.Field or <literal>`. The latter
requires the same identifier for the guard and receiver; competing field/default
expressions do not provide a single inferred role. Only generated binding names
change, using the existing global/explicit-name protections. No lookup, fallback,
short-circuit test or effect is moved or removed. The new official VM fixture
observes metamethod reads, false/nil defaults, captures and function debug names.
Function bindings keep their own declaration name even when later assignments
suggest another role; reserving names against other bindings alone is insufficient.
The reassignment regression observes a saved function alias before/after its
original local receives a field fallback, including `debug.info` and call results.

Official O0 execution of that regression exposed an earlier-stage collision:
a generated `tonumber` result had already consumed a later prototype's debug
name. The module allocator now holds genuine valid prototype names aside for
their owners. Generic temporaries cannot consume them; closure creation and
forward REF cells may claim their matching future prototype name. Actual globals
remain reserved, other prototypes' suffixes remain protected, and speculative
rollback retains the inventory. This does not claim to recover absent debug names
or resolve every collision between multiple genuine same-named prototypes.
