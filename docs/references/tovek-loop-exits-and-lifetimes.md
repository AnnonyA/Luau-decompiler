# Loop exits, closure freshness and lexical lifetimes

Reference: Tovek at `77edf387bf280a2f4d46d57ac85d5c4f071b763f` (MIT;
Jujhar Singh and Mathias Pedersen, 2024), inspected from the pinned public archive:

- `restructure/src/region.rs`, `LoopContext`: separate normal exhaustion from
  a return that skips the tail; exported loop results belong to the continuation.
- `ast/src/fresh_closures.rs`, `closure_identity.rs`: NEWCLOSURE identity can
  change after recompilation when a captured value folds into the function body.
- `ast/src/local_declarations.rs`: lexical ownership follows binding uses.

Official Luau at `9d7748a4f324213a18cb8283fa2a77c330225fa0`,
`Compiler/src/Compiler.cpp`: `compileInlineReturn` emits a jump to the inline
continuation after closing locals; `shouldShareClosure` rejects written captured
locals; `pushLocal` enforces the active-local limit. The implementation here is
independent TypeScript, not copied Rust.

## Implemented invariants

The common post-dominator owns merged loop results. If the normal exit reaches
an intervening tail, a flag selects that tail after the loop. A normal break
retains it, while an inlined return bypasses it. Result declarations precede the
loop, including nested numeric/generic loops. Already terminated alternatives do
not emit a second continuation or statements after a break.

Repeated NEWCLOSURE sites whose deferred/literal VAL capture could disappear get
one private written snapshot. This leaves other closures' captures untouched.
Existing VAL snapshots still preserve their value independently of REF cells.
Local closure declarations are registered in the lexical scope; treating them as
globals previously added redundant snapshots and exhausted local registers in
large factories. This is bounded freshness preservation, not full DUPCLOSURE
cache or environment emulation, nor a solution for capture-free fresh closures.

Large pending tables commit before excessive field snapshots accumulate, unless
a future SETLIST needs the constructor open. The final AST pass scopes short,
dependency-closed local lifetimes in large blocks. It preserves read/write and
nested-closure dependencies, moves no evaluation, and leaves repeat-body locals
visible to their condition. This is not a general register allocator: oversized
irreducible live sets may still exceed Luau's limits.

A close on a terminal return does not close the normal loop exit's entry cell.
Conversely, when both conditional paths close a cell, restoring pre-branch state
must not resurrect it, even if its register has no live SSA phi. These properties
are protected by the new returned-loop-cell fixture at O0/O1/O2.

The public samples are now observed development inputs. Stored first results and
sealed source/bytecode remain unchanged. A successful paired-source observation
with today's VM is distinct from direct execution of legacy bytecode, and from
an independent or blind competitive evaluation.

## Ordered arguments and wide result packs

The current follow-up also inspected `luau-lifter/src/lifter.rs` at the same
pinned Tovek revision: CALL and SETLIST keep all fixed registers before the
recorded open tail. Official Luau `VM/src/lvmexecute.cpp`, LOP_CALL, LOP_RETURN
and LOP_SETLIST, consumes through `L->top`; there is no 64-value limit. Our
reconstruction now bounds static prefix scanning by `maxStackSize`, while the
last open expression retains arbitrary result arity. Synthetic CALL/RETURN/
SETLIST tests and original 100/110-closure factories cover the former truncation.

Wide argument lists also exposed excessive local declarations. The final AST
pass substitutes resolved single-use argument temporaries only in their original
evaluation order, with a stable lexical callee and inert preceding arguments.
A final fixed-result call remains parenthesized. Callee lookups are snapshotted
before intervening calls; an adjacent snapshot can be folded back once nothing
observable separates its lookup from the call. Named single-result returns are
retained, including module names supplied by runtime context.

An immutable chunk-local capture alone does not make a loop-created closure
fresh: Luau may share it. Such NEWCLOSURE sites receive one private written
snapshot. Existing loop-local VAL snapshots of merged/REF cells already keep
those cells separate and are not turned into written captures.

## Cleanup binding identity

`copy_cleanup.rs` at the pinned Tovek revision requires snapshot ownership and
checks captured writes before replacing locals. Our independent implementation
uses `analyzeBindings` to protect captured stores and rejects effectful barriers.
The same resolved nodes drive coalescing reads and writes, including `do` and
interpolation; the old spelling-based walker skipped those containers. This
fixed the observed `constraint-search/O2` regression: a precedence predicate's
assignment remained on a removed name while its use called the preceding
cumulative-check closure. The raw reconstruction had the correct callee.

Anonymous-function initializers are repaired in their parameter/enclosing scope.
Inert literal constructors may be crossed by overwrite elimination; computed
nil/NaN keys and effectful expressions remain barriers.

The new, unsealed `fresh-captured-callee` regression was given an unconditional
round-count trace because its zero-iteration input originally produced no
observation. Identity and value checks remain unchanged. No pre-existing sealed
source, bytecode, competitor response, or first-evaluation result was modified.
