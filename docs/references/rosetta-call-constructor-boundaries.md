# Call and constructor boundaries exposed by Rosetta

References inspected for this independent TypeScript repair:

- Official Luau 0.747, `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`:
  `VM/src/lvmexecute.cpp` `LOP_NAMECALL`, `LOP_CALL` and `LOP_SETLIST`;
  `Compiler/src/Compiler.cpp` `compileExprListTemp` / `compileStatLocal`;
  `Ast/src/Parser.cpp` contextual `continue` parsing.
- Tovek, `ce2ea3325547fa3896f274b68013386338039040` (MIT, copyright
  Jujhar Singh and Mathias Pedersen): `luau-lifter/src/lifter.rs` NAMECALL/CALL
  pairing and SETLIST lowering; `ast/src/assign.rs` target/read ordering;
  `ast/src/inline_temps.rs` capture-aware motion checks; and
  `ast/src/formatter.rs` `is_valid_name`.
- Rosetta, `80f3c13ce48dc3318d5d49f54958f580937ca8aa`, suite `rosetta-3`.

No reference implementation code was copied or adapted. The repairs preserve
existing facts in this engine's register environment and pending table stack.

## Invariants

1. A NAMECALL placeholder is consumed by its paired CALL. A later CALL may use
   the function returned by that method, even when the deferred expression is
   still a `method-call` node. The existing `methodSelf` marker now distinguishes
   the placeholder from that result. This preserves both argument lists, the
   second call's side effects and the returned value pack.
2. Fixed-size SETLIST writes into an existing table. If a previous keyed write
   already materialized the constructor, its array slots are assigned on the
   same table; it is not replaced with a new array literal. The existing pending
   constructor path remains unchanged. General open-tail SETLIST on an already
   materialized table is outside this particular repair.
3. Pending allocations and fields are emitted before RETURN. Appending an unused
   constructor after the terminator both changed evaluation and produced invalid
   source. Flushing before the return retains the same builder semantics.
4. `continue` is a contextual keyword. Luau accepts it as a global, local,
   parameter, field and method name. Actual reserved words remain rejected.

## Evidence

The four project-authored sources in `tests/fixtures/rosetta-semantics` were
compiled using the official pinned compiler at O0/O1/O2, each with g1/g2. Rosetta
executed original and reconstructed bytecode for all 24 combinations. The base
`9d4f03fde53d611aef91028a2b1f7529b2f4ffaa` passes 8/24; this repair passes 24/24.
The first failures and both summaries are retained beside these notes. They
are development regressions, not an independent holdout evaluation.

The cases observe returned-function calls, multiple returns including nil holes,
closure effects, table aliases and fields, and contextual identifier syntax.
The fixture unit tests additionally inspect the nested-call AST, table identity
and placement of returns. The original Rosetta `builtins`, `roblox_names` and
`table_constructors` programs pass all 18 normal compilation profiles with the
repair. Full-tier results must be reported separately on the integrated commit.

### Speculative reconstruction follow-up

The first Quick run exposed a regression in conditional method calls: both value
walkers copied a NAMECALL expression but dropped its `methodSelf` marker. Thus
the new distinction above correctly rejected the markerless placeholder, but
the recovered call lost implicit self. Both speculative walkers now retain that
marker until CALL consumes it. `conditional-method-calls` adds six official
profiles covering if-expression and short-circuit alternatives. The middleclass
library passes all six profiles again, and calculator retains its four previously
passing profiles (its two pre-existing O0 mismatches remain separate work).

### Comparison guards and selected values

The value reconstructor also treated any conditional jump as a truthiness test
when one arm retained the register tested by the jump. That is invalid for
comparisons: `x < 1 and 1 or x` cannot become `x and 1`, since every number is
truthy. The `and`/`or` shortcut now requires JUMPIF or JUMPIFNOT and associates
each result with the actual true or false edge. Other jump forms retain their
comparison. The tested register is read after the guard prelude has executed,
before either speculative arm can reuse it.

This repair was informed by the same pinned official compiler's
`Compiler.cpp::compileExprAndOr` and Tovek's
`ast/src/conditional_expressions.rs` (`fold_self_guards` and `chain_value`).
The compiler separates condition lowering from value selection, while the
reference's short-circuit folds require value-exact guards. No code was copied.

The independent `comparison-selected-values` source checks clamped ranges and
nil/false/zero selections at all six profiles. The original main passes 2/6;
the comparison repair passes 6/6. The first failed reconstructions are retained
in `benchmarks/results/rosetta-comparisons-2026-11-27`. On Rosetta's own programs,
`loops` passes 6/6 and `lume` passes 5/6. The remaining lume O2g1 failure is a
distinct collision between successive phi bindings and is not reported as a
pass.

### Aliases across successive phi joins

The remaining lume failure reused one physical temporary register for two
selected values. MOVE had already copied the first selected value into another
register. Reusing the same source local for the second phi required a snapshot
of that earlier copy. Snapshots created inside each alternative were discarded
when the common environment was restored; the later return incorrectly read
the second value twice.

Before a split, alias snapshots now cover every join phi that will reuse the
current binding's name, not only open reference captures. Thus the snapshot is
owned by the enclosing scope and both alternatives retain it. This extends the
existing alias-preservation mechanism without merging unrelated phi families.
The official pinned VM's MOVE implementation and Tovek's pinned
`cfg/src/ssa/destruct.rs` copy coalescing/interference checks were inspected for
the underlying value-identity rule. This is an independent repair.

`sequential-phi-ranges` preserves the first selected bound while computing the
second, exercising positive, negative, nil, false and zero inputs. The original
main passes 5/6 official profiles; the repair passes 6/6. Its first failure and
both summaries are in `benchmarks/results/rosetta-phi-aliases-2026-11-27`.
With both comparison and alias repairs, lume passes all six normal profiles.

### Constructors assigned to live captured cells

Libdeflate exposed a table identity error: a nil-initialized local was captured
by reference, then assigned an empty table later. NEWTABLE entered the pending
constructor stack, whose eventual declaration created a new local. The captured
cell remained nil. Merely using the old name at flush time was insufficient:
another closure call could run before the deferred allocation was emitted.

NEWTABLE and DUPTABLE that target a live REF cell now use the existing `define`
assignment path immediately. The cell and any old value aliases keep their
identities, and subsequent field writes remain at their bytecode positions.
Ordinary constructors still use the pending table path. The pinned official
compiler's `compileExprTable` explains this shape: an empty constructor writes
directly into its target even when the target is not a temporary. Its VM MOVE
and NEWTABLE behavior and Tovek's capture-sensitive SSA copy rules establish
why a new lexical binding cannot substitute for an update of the captured cell.

The project-authored `captured-table-reset` observes two successive table resets
through the same closure and retains the first object through aliases. At
integrated predecessor `d84bfe9`, it passes 2/6 profiles (the compiler inlines the
observer at O2); the repair passes 6/6. Initial failures and both reports are
retained in `benchmarks/results/rosetta-captured-tables-2026-11-27`. Libdeflate
advances beyond empty/short input compression after this repair, but its next
LZ77 mismatch remains a separate failure and is not counted as a pass.

### Phi declarations in repeated lexical regions

Several short-circuit paths can reach the same bytecode region. When source
reconstruction emits that region inside separate alternatives, a declaration
remembered from the first alternative is not visible in its sibling. Both loop
phi hoisting and join declarations now consult the current lexical scope before
skipping a declaration; the global phi-name cache alone is insufficient.

Tovek's pinned `ast/src/local_declarations.rs` models declarations with a lexical
scope tree and finds a common scope for uses. The pinned official compiler's
`compileStat` block handling likewise restores its local stack when a block
ends. These references support the scope invariant; this repair independently
uses this engine's existing scope stack.

The project-authored `shared-nested-phis` contains two values selected inside a
shared short-circuit loop body. Integrated predecessor `6fe43da` passes 2/6
profiles; the repair passes all six. The unit regression verifies that no
branch-local name escapes as an accidental global. Its preserved first failures
and summaries are in `benchmarks/results/rosetta-phi-scopes-2026-11-27`.

### Empty string constructor keys

The SETTABLEKS pending-constructor check tested a decoded key by JavaScript
truthiness. This incorrectly rejected the valid empty string and emitted a
write against a stale register value before constructing its actual table.
The check now rejects only `undefined`; the empty key remains a literal field
of the pending table. Official Luau's pinned SETTABLEKS implementation requires
a string constant without excluding zero-length strings, and Tovek's pinned
SETTABLEKS lifting likewise retains the constant as the index.

The project-authored `empty-constructor-key` preserves the empty field, other
fields and an alias. Predecessor `35b8e0c` passes 2/6 official profiles and the
repair passes 6/6. Preserved failures and reports are in
`benchmarks/results/rosetta-empty-key-2026-11-27`. Rosetta's seed1142 also passes
all six normal profiles with the integrated fixes.

### Computed loop updates through temporaries

A complex accumulator update can read the old value several instructions before
its final store. The final ADD reads temporary registers, so checking only that
instruction's direct register reads missed the relationship. Debug names then
created an inner local, while the loop continued reading its outer phi binding.

The loop-owner check now also follows SSA value dependencies through moves,
arithmetic, unary operations, concatenation and phis. It requires both the
existing non-alias owner and a path back to that loop's phi. A reused physical
slot alone does not qualify. Tovek's pinned SSA destructor self-update checks and
the official pinned compiler's `compileExprBinary`/`compileExprAndOr` lowering
were inspected; no reference code was copied.

`computed-loop-update` reverses several bit patterns with an update split across
temporary values. Predecessor `2b4d692` passes g1 but fails every g2 profile; the
repair passes 6/6. Preserved failures and both reports are in
`benchmarks/results/rosetta-computed-loop-2026-11-27`. Libdeflate
now reaches its chat encoding tests in all six profiles, with that remaining
loop reconstruction failure reported separately.

## Nested constructors in selected-value guard preludes

Reference revisions remain Tovek `ce2ea3325547fa3896f274b68013386338039040`
and official Luau `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f` (0.747).
Tovek's `luau-lifter/src/lifter.rs` SETLIST lowering retains every operand
register as an explicit read. Its `ast/src/inline_temps.rs` also treats those
operands as constructor consumers. Official `compileExprTable` batches array
operands before emitting SETLIST, and the VM copies their current values into
the destination table.

The ordinary reconstruction path already materialized pending child tables
before reading those operands. The speculative selected-value guard path did
not: it could preserve the child allocation as a separate local while storing
the previous scalar value from the child's physical register in its parent.
The independent repair applies the same operand materialization to retained
guard preludes, excluding the destination constructor itself. No reference
implementation was copied.

The authored `guard-constructor-operands` fixture exercises two nested tables,
subsequent mutation, fixed and open call returns, and a following conditional
value. Its first independent result was 2/6; after the repair all six official
optimization/debug profiles pass. Rosetta seed 1945 also passes all six, giving
12/12 directed round trips in the preserved candidate report. Baseline, first
failure and candidate evidence are in
`benchmarks/results/rosetta-guard-constructors-2026-11-27`. This is a development
regression result, not a new blind benchmark total.

## Shared early returns are not loop continuations

The same pinned Tovek `restructure/src/region.rs` computes common
post-dominators while retaining all exit paths; `cfg/src/ssa/structuring.rs`
preserves the values and arity of short-circuit return edges. Official Luau
0.747's `compileConditionValue` branches each failed `and` operand to the
early-return block, while a successful final operand reaches the remaining
loop body.

Our loop-local join fallback previously mistook that shared early-return block
for a continuation simply because both alternatives could reach it. The
successful path also had a backedge, so the return did not post-dominate the
branch. The independently implemented repair limits this reachability fallback
to joins inside the current loop. True post-dominator joins retain their
existing handling; early terminal regions remain in their guarded alternatives.

The authored `compound-guard-return` fixture tests two valid iterations, each
of four failed operands, an empty loop, and both return values. It improves
from 0/6 to 6/6 across the official optimization/debug profiles. Libdeflate's
unmodified specification now passes all six profiles as well, including every
encoding/decoding assertion after the former DecodeForPrint failure. The
12/12 directed result and first independent fixture failures are preserved in
`benchmarks/results/rosetta-compound-returns-2026-11-27`. These are development
regressions; aggregate suite results are recorded separately.

## Runtime power rounding

At the same official Luau 0.747 revision, `VM/src/lvmexecute.cpp` implements
numeric POWK with exponent 2 or 3 using multiplication, in left-to-right order.
POW and `Compiler/src/ConstantFolding.cpp` instead use `pow`. The rounded results
can differ in their last bits. Reconstructing an originally assigned numeric
local as an immutable initializer can expose a new compiler constant fold,
making that difference visible through string formatting. Tovek's pinned
`luau-lifter/src/lifter.rs` was inspected: it maps both opcode forms to power
expressions; the additional distinction here is an independent implementation.

Only POWK with exponent 2 or 3 is lowered to the VM's multiplication sequence,
and only when SSA proves numeric operands through constants, moves, unary minus
and numeric arithmetic. Unknown values, calls, table reads and phis fail that
proof. A reference capture that can reach any participating operand read also
invalidates the proof, including captures reached through a loop backedge.
Only literal/identifier operands may be read repeatedly; other expressions keep
their original power form. Unknown operands therefore retain their `__pow`
metamethod behavior and are never replaced by `__mul`.

The authored `runtime-cube-rounding` fixture improves from 2/6 to 6/6. A separate
`power-metamethod-boundary` fixture verifies unknown operands and a numeric REF
cell changed to an object by a callback. Together with Rosetta seed 1077 these
pass 18/18 directed round trips. First independent failures and both reports
are preserved in `benchmarks/results/rosetta-runtime-powers-2026-11-27`. General
reproduction of every platform-sensitive math specialization is not claimed.

## Constructor field snapshots and open tails

References remain Tovek `ce2ea3325547fa3896f274b68013386338039040` and official
Luau `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f` (0.747). The official
`compileExprTable` emits fixed SETLIST batches before named fields, then an
open SETLIST for a final call or vararg. VM SETLIST copies the current register
values into the existing table, including every value of the open pack.
Tovek's SETLIST lifting retains both the fixed operands and the open tail;
its temporary-inlining logic was inspected for constructor consumers and
evaluation order. This repair was independently implemented in our pending
constructor representation; no reference implementation was copied.

A mutable named field previously forced early materialization. The later open
SETLIST fallback created a different partial table, losing its prefix and
turning its final call into a keyed, single-valued field. A pending constructor
that will receive an open SETLIST now snapshots its mutable field operands at
the original write. Fixed list operands also snapshot mutable locals rather
than reading their later values. Once an open tail is complete, the entire
constructor is materialized before a subsequent effect: a single-local
snapshot would truncate the tail, while leaving its call deferred would move
observable effects past later instructions.

Three authored fixtures cover mixed list/named fields, nil holes in an open
tail, nested table identity, explicit side-effect observations, loop updates
and a reference-captured mutable source. Each had a preserved independent
0/6 result for its corresponding failure and now passes all six official
optimization/debug profiles. Together with Rosetta seeds 1101, 1307, 1334,
1369, 1519 and 1942, the directed candidate passes 54/54. Baselines, first
failure sources/outputs and candidate evidence are in
`benchmarks/results/rosetta-constructor-snapshots-2026-11-27`. These are
development regressions; transformed Hard constructor cases with a different
failure mechanism remain under investigation.

## Open packs across straight control chains

At the same official Luau and Tovek revisions, VM CALL/RETURN consume the
dynamic frame top for multret operands. An unconditional jump does not change
that top. Tovek's lifter tracks a separate pending top and consumes it through
`take_top`, rather than treating the first register as the whole result.

Our forwarding decision previously scanned instructions by physical PC after
the producer. A shuffled block could place its consumer earlier, making the
scan incorrectly materialize the open pack into one local. The independent
repair follows a unique successor/predecessor CFG chain and recognizes only
compatible open consumers or the existing explicit MOVE protocol. It stops at
joins, branches, cycles, overwritten operands and a replacement call/vararg
top. It does not add a general pack merge across conditional paths.

The authored `open-pack-linear-chain` source checks five results with nil
holes and producer/consumer effects. Its six official compiled files are
sealed alongside six independently permuted variants. The fixture generator
moves only the forwarding helper's producer/consumer blocks, adds unconditional
edges, and retains valid whole-function parameter ranges. The official VM
produces identical output for each original/transformed pair. The prior
frozen engine passes 0/6 transformed round trips; this repair passes 6/6.
Evidence is in `benchmarks/results/rosetta-open-pack-chains-2026-11-27`.
Rosetta Hard seed 1633 also regains its full first-call arity; an independent
later control-flow failure remains reported as a mismatch, not as a pass.

## Observable signs of NaN literals

At the pinned official Luau 0.747 revision, numeric constant folding preserves
unary negation of NaN, while `VM/src/lstrlib.cpp` passes `%g`/`%f`/`%e` to
`snprintf`. The sign therefore affects formatted strings, their lengths and
`buffer.writef64` observations. The pinned Tovek `ast/src/literal.rs` also
distinguishes the two signs in its source spelling; it notes the tested VM's
negative default NaN from `0 / 0` and uses unary negation for the positive one.
These references informed an independent implementation in our TypeScript
printer and AST-copy boundary; no reference code was copied.

Both numeric printers now share `formatNumber`, which examines the NaN sign
bit and emits a fully grouped arithmetic spelling. No global constructor is
introduced. The AST-copy helper also replaces structured serialization in
the optional rewrites, local-lifetime and inline-recovery passes: JavaScript
`structuredClone` canonicalizes NaNs, erasing their signs before printing.
The new copy keeps numeric primitives and within-copy sharing while detaching
mutable AST records. Its tests separately check non-default NaN bits and
negative zero across copying; general source reconstruction of arbitrary NaN
payloads or untested VM floating-point conventions is not claimed.

The authored `signed-nan-literals` fixture checks both formatted signs, string
lengths, their stored sign words, closure/table reads and unordered comparisons.
Its first result was 2/6; the candidate passes 6/6. Rosetta seeds 1301 and 1527
also pass all six official profiles, giving 18/18 directed round trips.
Baseline, first independent failure and candidate reports are preserved in
`benchmarks/results/rosetta-signed-nan-2026-11-27`.

## Conditional JUMPBACK transfers

The same pinned official Luau compiler uses JUMPBACK for the interruptible
transfer to a while condition; its VM performs that jump after the interrupt
and GC checks. Tovek's pinned region reconstruction was inspected for loop
header transfers and explicit continues. In source, reaching that backedge
inside one conditional arm must end the iteration even if another shared
branch body follows physically in the reconstructed region.

Our emitter already recognized JUMP/JUMPX to a loop header or pure latch as
`continue`, but omitted JUMPBACK. A transformed heap operation consequently
executed both alternatives, corrupting its heap before a later nil index.
The independent repair applies the same CFG-target check to JUMPBACK; it
does not infer a continue from a backward physical offset alone.

The authored `conditional-backedge` fixture observes branch-specific effects,
different step sizes, both break thresholds and an empty loop. Its first Hard
result was 3/6. The candidate passes all six Hard profiles and all six normal
profiles. The three formerly failing shapes also assert that their selected
arm ends in `continue`. First failures and round-trip evidence are preserved
in `benchmarks/results/rosetta-conditional-backedges-2026-11-27`.

## Iterator result names follow control flow

At the pinned Luau revision, FORGLOOP writes its distinct result registers
before transferring to the loop body. Tovek's pinned lifter likewise creates
one result local for each register in the FORGLOOP result range. These are
separate values even when layout permutation places the continuation before
the loop header in physical bytecode order.

Our unused-result naming previously scanned the physical PC interval between
header and follow. That interval can be empty after valid block permutation,
so two live results received the same `_` binding and key reads became value
reads. The independent repair scans reachable CFG blocks until the loop's
follow, including returning arms outside the natural loop. It conservatively
retains a distinct name whenever a real instruction reads that register;
iterator protocol bookkeeping remains excluded from that decision.

The authored `iterator-shuffled-follow` fixture observes both key and value,
their different types, a sum and the continuation of an empty loop. Six
official compilations and their independently permuted variants are sealed
alongside the reproducible transformation. Each original/transformed pair
has identical VM behavior. With the earlier generic-entry repair present,
the first result was 0/6 and this naming repair passes 6/6; the normal source
also passes 6/6. Rosetta's oop and libdeflate Hard controls pass 12/12 with the
preceding control-flow fixes. Evidence is retained in
`benchmarks/results/rosetta-iterator-results-2026-11-27`.

## Open packs with unreachable incoming edges

At the same pinned official Luau revision, GETVARARGS with an open count sets
the dynamic frame top to the actual number of arguments, including zero; an
open CALL consumes that top. The pinned Tovek lifter's `take_top` similarly
keeps the tail as a pack expression until RETURN/CALL consumes it. Neither
protocol is affected by an incoming edge from code that cannot execute.

Our straight-chain forwarding guard previously required exactly one stored
CFG predecessor. A retained unreachable decoy therefore made an otherwise
linear GETVARARGS/CALL chain materialize its pack into one local. For an empty
pack, that changes `select("#", ...)` from zero to one. The independent repair
counts reachable predecessors only; live joins, branches and cycles still
decline the existing bounded forwarding proof.

The authored `open-pack-dead-predecessor` checks empty arguments, nil holes,
multiple results and a captured side-effect counter. Its six original and
transformed bytecode pairs execute identically in the official VM. The
reconstruction stage before optional normalization passes 0/6 transformed
inputs before the repair and 6/6 afterward, while its six normal controls
stay passing. A direct stage test is intentional: the full pipeline already
normalizes these small authored decoys away, but normalization can decline
on larger layouts. That earlier passing full-pipeline probe is also retained.
Rosetta seed 1306's naturally retained decoy reproduces the full-pipeline
failure on the integrated base; the candidate passes all six normal and six
Hard profiles. Evidence is in
`benchmarks/results/rosetta-open-pack-unreachable-2026-11-27`.

## A terminal generic iteration shares its continuation

The pinned official compiler patches a generic body's break to the end of the
FORGLOOP/AUX pair. Once an always-breaking empty body is threaded, success
and exhaustion can have the same destination. The VM still performs the
iterator step before choosing that destination. Tovek's pinned FORGLOOP
lifter was inspected for this case: it retains a separate empty iteration
body rather than treating the shared successor as user code inside the loop.

Our loop reconstruction now identifies coincident success/exhaustion edges
after pure jump adapters. It uses their shared target as the continuation
and emits an explicit `break` body. Previously, the postdominator of the
continuation's first branch could become the loop follow; this put later
locals in an artificial conditional scope and left their uses outside it.
The repair preserves a single iterator invocation, including for empty
results, without moving the continuation into the iteration or its guard.
This is an independent bounded repair in the existing TypeScript loop model.

The authored `terminal-iterator-continuation` observes a table's fields and
captured identity after another conditional loop. Its first result was 0/12
normal/Hard profiles and the candidate passes 12/12. A second authored
control checks the custom iterator's call count for empty and nonempty
ranges and also passes 12/12. An independently authored team control adds
an effectful `__iter`, distinct captured tables and nil return holes; it
passes 12/12. With the preceding canonical-region-stop repair, seed 1042
passes all six normal and six Hard profiles. Evidence is retained in
`benchmarks/results/rosetta-terminal-generic-2026-11-27`.
