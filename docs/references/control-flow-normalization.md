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
