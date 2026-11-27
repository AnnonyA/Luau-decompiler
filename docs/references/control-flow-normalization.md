# Reconstruction from control flow rather than physical bytecode layout

The implementation is independent TypeScript; no implementation source was copied.
References inspected for this change:

- Official Luau **0.747**, `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`:
  `VM/src/lvmexecute.cpp` (`LOP_JUMP`, primitive comparisons, `LOP_LOADB`,
  `LOP_CLOSEUPVALS`, and the numeric/generic iteration instructions),
  `Common/include/Luau/BytecodeUtils.h`, and
  `Compiler/src/Compiler.cpp` (`compileStatWhile`, `compileStatRepeat`,
  `compileStatFor`, `compileStatForIn`).
- Tovek, `ce2ea3325547fa3896f274b68013386338039040`, MIT (`LICENSE.txt`):
  `cfg/src/ssa/structuring.rs` (`simplify_condition` and graph edge ownership),
  `luau-lifter/src/lifter.rs` (numeric/generic iteration provenance and
  `loop_jump_target`). The useful invariant is that a jump names an edge,
  while a loop instruction also carries register protocol information.

`normalizeControlFlow` operates on a separate reconstruction module. The public
bytecode decoder, input instruction words and disassembly remain unchanged.
Diagnostic PCs retain their original input provenance. A bounded executable-edge
analysis tracks only primitive constants and folds only comparisons proven from
those values. Unknown equality, objects, userdata and possible metamethod effects
remain dynamic; NaN is never assumed reflexive. Calls invalidate facts about
open reference captures and their overwritten register windows.

The pass removes NOPs and unreachable instructions, threads control-only jumps,
and recognizes register self AND/OR as MOVE. A live FORNPREP retains its otherwise
unreachable FORNLOOP metadata when its body always breaks. JUMPBACK interrupts,
CAPTURE modes, CLOSEUPVALS boundaries and register-pack arity are preserved.

A separate layout pass schedules basic-block regions only when backward acyclic
edges demonstrate a shuffled physical order and local debug ranges are absent.
Each moved edge remains explicit, and short LOADB/FASTCALL bundles stay together.
It pairs numeric-loop metadata with no execution path by its preparation's
body/exit edges; an ambiguous pair retains the existing function layout.
This is not arbitrary irreducible-CFG recovery or a proof that all reconstruction
passes are independent of physical register numbering.

## Fixed-result call liveness

Review of `LOP_CALL` / `LOP_RETURN` in the same official VM revision and CALL
lifting in the same Tovek revision confirmed that fixed-result calls define only
their requested result slots. The callee can reuse part of the caller's higher
stack area, so constant facts above the call base are invalidated conservatively;
that possible overwrite does not prove every higher value dead. Liveness kills
only the fixed result definitions. Open calls and vararg packs may produce zero
values, so their abstract pack base is not a definite scalar write. A
project-authored bytecode reduction retains a high register after
a small closure call: the original VM prints `37`, while the first normalization
removed its initialization. The regression covers zero, one and two requested
results as well as empty open packs; the repaired normalized bytecode again
prints `37` in the official VM.

## Rebuilding instruction-stream metadata

Relocation now decodes the complete instruction stream before restoring PC
provenance. Decoding isolated words loses the existing annotations for fixed
arguments before an open result tail, and for the variables initialized by a
generic iterator's preparation. The source SSA must receive those annotations
even when the encoded instructions themselves are unchanged. This follows the
same official CALL/FORGPREP protocol and Tovek's explicit fixed-prefix/open-tail
representation cited above; the implementation reuses our existing stream
decoder rather than duplicating its rules.

The independently authored `open-prefix-iteration.luau` exercises conditional
values before a variadic tail in calls, list constructors and returns, together
with a generic iterator. Before the fix its three ordinary profiles passed but
all six transformed profiles printed a missing conditional argument. After the
fix all nine profiles pass the official Rosetta runtime comparison. Unit
regressions also retain the preparation's definitions and the open call's fixed
argument uses after removing control-flow noise.

## Boolean loads with an unconditional skip

The same official VM revision implements `LOP_LOADB` by assigning the boolean
then advancing the PC by its unsigned C field. Tovek `ce2ea332`'s LOADB lifting
likewise emits only the skip edge when C is nonzero. Our CFG previously also
added an impossible fallthrough into the skipped boolean assignment. That edge
could make statements after a comparison appear exclusive to its true arm when
the physical block order had changed.

The CFG now gives a skipping LOADB only its actual successor. The Rosetta
`operators` case with the O1g1+x2 profile previously omitted an observation for
an unordered NaN comparison; it now passes. Together with the project-authored
`boolean-skip-observations.luau`, ordinary O0/O1/O2 and all six Hard profiles pass
18 runtime comparisons. The CFG regression directly checks that the skipped
block is not a successor.

## Terminal numeric bodies in shuffled code

An unreachable FORNLOOP can still describe a live preparation whose body always
breaks or returns. Keeping only that instruction is insufficient when its exit
runs through an unreachable jump stub. Compaction now retains that pure exit
chain, and layout pairs the marker with its preparation only when both body and
exit destinations match through NOP/JUMP/JUMPX chains. CLOSEUPVALS and other
effects are never threaded as control-only instructions. The marker is placed
after its body with every actual execution edge preserved.

Locally constant guards can appear even on those unreachable marker paths.
Constant propagation analyzes numeric iteration markers as additional entries
with no facts, allowing their local primitive guards to be proved. These extra
entries can only remove otherwise known facts; executable reachability and
instruction retention still start from the real function entry. Source loop
break/continue recognition also treats JUMPX like the equivalent JUMP encoding.
The implementation is independent and follows the official numeric loop
protocol and Tovek iteration provenance cited above.

The new project-authored `shuffled-terminal-loops.luau` passed five of nine
profiles before this fix and all nine afterward. The two committed bytecode
regressions use official Luau 0.747 through Rosetta `80f3c13ce48dc3318d5d49f54958f580937ca8aa`,
with O0g2+x2 and O2g1+x3. Together with `contextual_keywords`, all eighteen
ordinary/Hard runtime round trips pass. Four direct original-bytecode versus
normalized-bytecode comparisons also exit successfully with identical output;
they cover both committed fixtures and contextual keywords at O1g1+x2 and
O1g2+x3.

## Tracking the producer of an open result tail

Liveness now distinguishes an open pack from prior scalar contents in higher
frame slots. A bounded forward analysis records the producer PC and base of an
open CALL or GETVARARGS. A join retains that information only when every incoming
path agrees. The proof survives control-only transfers and a small set of
top-preserving loads/copies below the tail; a write into the tail, fixed call or
unrecognized operation discards it. An identified consumer reads its fixed prefix
and the producer's tail, while an unknown consumer conservatively reads the
whole possible register window. This does not change the scalar definition kills
described above: a later scalar use still keeps its old definition live.

Besides the pinned CALL and vararg VM implementations, this change inspected
`VM/src/lvmutils.cpp` `callTMres` and `VM/src/lvmload.cpp` `luaV_getimport` at the
same official revision. Those fallback global/import loads restore the current
top, including when a metamethod runs. Writes to REF-captured registers remain
excluded from dead-result elimination. Tovek's explicit fixed arguments followed
by an open tail (`luau-lifter/src/lifter.rs`, same pinned revision) informed the
representation; the analysis is independently implemented.

This removes an otherwise unused boolean between a numeric preparation and its
loop header in `loop_closures` O2g1+x3, which previously hid the remaining source
after that loop. That case and three existing project-authored fixtures pass
36 ordinary/Hard runtime checks. The additional `open-tail-loop-capture.luau`
fixture passes nine profiles both before and after the change. Six independent
raw-bytecode comparisons exercise zero and three returned values, a scalar read
after the call, and a scalar written into an existing tail; all exit successfully
with identical output. Unit cases also cover an incoming path without a producer
and a fixed call that resets the frame top.

## Explicit transfers to returning loop arms

A natural loop's block set excludes paths that return instead of reaching its
backedge. Source emission formerly treated any explicit JUMP/JUMPX outside that
set as `break`, including a transfer to a function return. Shuffled layout made
that distinction observable even when the original compiler used fallthrough.

The emitter now recognizes a bounded terminal case: a chain of single-successor
blocks that reaches RETURN without entering the loop or its normal continuation.
It leaves that chain to ordinary statement emission, preserving all intervening
work, captures and return arity. Conditional or cyclic chains are not inferred
by this helper. Tovek `ce2ea332` `cfg/src/ssa/structuring.rs` distinguishes loop
exit transfers from terminal RETURN blocks and protects multret return arms;
official Luau `c87565b8` `LOP_RETURN` returns from the call frame. These references
informed the independent TypeScript change.

A project-authored bytecode reduction executes a loop with an early result of
75 and a normal result of 3. The first decompilation returned 0 and 3; the repaired
source matches 75 and 3 in the official VM. Unit variants cover both JUMP
encodings. Two additional Luau fixtures cover normal breaks, zero/open returns,
closure captures and work before a terminal transfer across nine profiles each;
all eighteen checks pass. The six remaining Hard pathfinding variants improved
from twelve of twenty-four to twenty-four of twenty-four tested round trips.

## Distinguishing terminal alternatives from normal loop completion

A repeat loop with an empty early return and a counted normal return has two
terminal exits. Without a common post-dominator, their physical block numbers do
not identify the normal continuation. The repeat's recognized until test now
provides that exit. An alternative that starts exactly at the enclosing loop
follow emits its break before the inner region's stop boundary is applied; this
retains `if cancelled then return end; break` in a generic-for body.

Optimized inline returns can instead join after a normal-result assignment.
Repeat loops now use the same guarded completion-tail mechanism as the existing
while and for loops. Their exit guards remain in the body in this shape, so the
final comparison reads the value loaded on its own continuing path. Pure
NOP/JUMP/JUMPX adapters are resolved consistently when identifying normal exits
and follows. CLOSEUPVALS, register writes and other work remain distinct blocks.
This also avoids putting the shared no-match return of a shuffled generic loop
inside the body and losing it on empty/exhausted iteration.

The references remain official Luau
`c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f` (`compileStatRepeat`,
`compileStatForIn`, and `compileInlineReturn` in `Compiler/src/Compiler.cpp`) and
Tovek `ce2ea3325547fa3896f274b68013386338039040`
(`cfg/src/ssa/structuring.rs`, separate terminal RETURN arms and preserved loop
exit adapters). The TypeScript changes are independently implemented; no code
was copied. The committed fixture bytecode was compiled with official Luau 0.747
through Rosetta `80f3c13ce48dc3318d5d49f54958f580937ca8aa` at the profile in each
filename.

Three project-authored sources initially failed all eighteen ordinary profile
round trips and pass after the repair. The two corresponding Rosetta development
mutants improve from two of twelve to twelve of twelve ordinary round trips.
Their Hard cases plus the authored reductions, open-tail capture and terminal
arity fixtures pass all forty-two tested Hard round trips. The first evaluations
and final targeted reports are retained in
`benchmarks/results/terminal-loop-follow-2026-11-27`; these are development
regressions, not a new full-suite score.

## Continuations also follow the iterator's empty path

The header of a for body that always breaks can have an immediate
post-dominator inside that body, such as the join of a boolean argument or a
nested repeat. These blocks need not belong to the natural loop, because they
cannot reach its latch. A candidate loop continuation now must also
post-dominate the FORGLOOP/FORNLOOP latch. This includes the zero-iteration and
exhaustion path before accepting a common continuation. The existing explicit
latch exit remains the fallback, including unreachable numeric step markers.

Official Luau `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`'s FORGLOOP execution
and compiler `compileStatForIn` establish the distinct body/exhaustion edges.
Tovek `ce2ea3325547fa3896f274b68013386338039040` retains the corresponding
`GenericForNext` body edge and exit adapters in `cfg/src/ssa/structuring.rs`.
Our post-dominator test is independently implemented.

The two authored first-item fixtures improved from zero of twelve to twelve of
twelve ordinary profiles and also pass all twelve Hard profiles. Rosetta
development seeds 1113 and 1257 pass twelve of twelve ordinary profiles together;
their Hard checks pass nine of twelve, leaving three seed1257 layout failures
explicitly recorded. First and follow-up results are kept in
`benchmarks/results/iterator-completion-2026-11-27`.

## Committed guard preludes execute once per visited block

Boolean/value reconstruction can emit the instructions before a comparison
without calling the straight-block emitter. A loop backedge could consequently
visit that header again during source construction and append a second copy of
its increment or call prelude. A successful branch reconstruction now marks its
basic block as emitted, regardless of the particular guard representation.
This changes source traversal bookkeeping, not the bytecode's runtime backedge.
It preserves the separate CLOSEUPVALS instruction and closure cell lifetimes.

The authored `repeat-boolean-prelude.luau` stores a distinct mutable closure cell
on each iteration and observes repeated writes to two saved cells. Its first
six ordinary round trips returned a counter of five and only three closures
instead of four and four. All six pass after the correction. Together with
Rosetta development seeds 1247 and 1356, the ordinary targeted checks improve
from six of eighteen to eighteen of eighteen; the first and follow-up results
are recorded in `benchmarks/results/committed-loop-guards-2026-11-27`. The pinned
official repeat/backedge and capture references above govern the invariant;
this traversal fix is independently implemented.

The same canonical exit identity is used by while-header setup. Comparing a raw
JUMP adapter to its resolved follow would incorrectly emit the adapter as an
extra exit tail, then append a second break after its existing terminal. Header
setup now resolves that control-only adapter too and never appends a break after
an already terminal tail. Direct CFG regressions cover JUMP and JUMPX adapters;
the `while-exit-adapter.luau` coverage passes six Hard profiles before and after.

## Trivial jumps at fixed-width fast-call landings

A FASTCALL landing must retain its instruction address so the short C-field
still identifies its matching CALL. When that landing is a JUMP/JUMPX to the
next retained instruction, normalization now keeps a one-word NOP at that
address. Previously it retained the jump terminator, which split a constructor
across basic blocks between its fixed fields and open SETLIST tail.

At official Luau `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`, the NOP, JUMP,
JUMPX and FASTCALL1 cases in `VM/src/lvmexecute.cpp` establish the word widths,
next-PC arithmetic and matching-CALL offset. Tovek
`ce2ea3325547fa3896f274b68013386338039040`'s FASTCALL lifting preserves the
fallback CALL as the source operation. This bounded normalization is independent
and retains the landing PC instead of changing that call protocol.

The seed1174 O1g2+x3 development regression lost earlier table fields before the
change and passes afterward; all six of its Hard profiles pass. Two unit cases
assert the retained NOP address, FASTCALL target and unified CFG block. Four
project-authored raw-bytecode comparisons cover JUMP/JUMPX on builtin and
getfenv-triggered fallback execution; all original and normalized executions
exit successfully and print the same result. The inputs, outputs and statuses
are saved in `benchmarks/results/pinned-fastcall-landing-2026-11-27`.

## A structured join is not an additional loop-exit edge

The alternatives of a statement-if already emit their own breaks, returns and
iteration continuations. Advancing the source walker to that if's structural
join must not introduce another unconditional break just because the join is
the enclosing loop follow. The walker now distinguishes a committed statement
join from an actual CFG transfer. A branch that starts at the follow still emits
its required break, and guarded completion tails still terminate the region.

This corrects a regression in the earlier terminal-alternative change. Rosetta
`iterators` had stopped its Collatz loop after one iteration. The authored
`while-exit-work.luau` independently reproduced the same premature exit in all
six ordinary profiles while observing a side effect only on the capped path.
It now finishes the continuing iterations and retains both early exits. The
first result and targeted ordinary checks, including the original empty-return
and generic-break regressions, are stored in
`benchmarks/results/structured-loop-follow-2026-11-27`.

## Canonical destinations also bound enclosing source regions

A nested loop can resume after a pure JUMP adapter that is the enclosing if's
join. The loop-follow analysis already resolves that adapter. Source traversal
now resolves its stop through the same NOP/JUMP/JUMPX-only helper, so it does
not skip the enclosing boundary and emit the entire continuation inside an arm.
Instructions that close cells or perform other work remain region boundaries.

This is an independent implementation in our IR. The reference review used
Tovek `ce2ea3325547fa3896f274b68013386338039040`'s `structure_jumps` treatment of
loop exits and official Luau `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`'s
JUMP/NOP VM cases and `BytecodeBuilder::foldJumps` target traversal. No reference
code was copied. The latter also makes clear why multiple valid bytecode
layouts can name different adapters for one continuation.

A direct CFG reduction has a counted loop inside a conditional whose join is
a JUMP to the function return. Previously source reconstruction emitted that
return twice; it now appears once after the conditional. All four argument
combinations still produce 2, 10, 100 and 100 in the official VM. Separate
authored runtime controls cover side-effect order, independent mutable capture
cells, empty iterators and multiple returns across ordinary and Hard profiles.

Rosetta development seed1042 no longer times out at O0: both ordinary O0
profiles and their Hard counterparts pass. Its O1/O2 profiles retain a separate
table-to-nil mismatch; this change does not claim to resolve that mismatch.
Reports, the component's original and repaired source, and exact provenance
are kept in `benchmarks/results/canonical-region-stop-2026-11-27`.
