# Guarded loop exits and scalar format presentation

This change independently implements three bounded invariants. It does not use
source text from the benchmark, alter its corpus or scorer, or infer an original
source from debug names.

## References inspected

- Tovek `ce2ea3325547fa3896f274b68013386338039040`, MIT license, copyright
  Jujhar Singh and Mathias Pedersen (2024): `ast/src/recover_guard_continue.rs`
  keeps terminating work attached to its predicate; `ast/src/formatter.rs`
  discusses scalar interpolation, arity and mutable formatting;
  `restructure/src/region.rs`, `build_conditional_inner` and
  `reaches_in_iteration`, distinguish a join in this iteration from a path that
  terminates or returns to the next iteration.
- Official Luau `9d7748a4f324213a18cb8283fa2a77c330225fa0` and
  `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`: `Compiler/src/Compiler.cpp`,
  `compileExprCall`, `compileExprInterpString`, `compileStatRepeat` and the
  `AstStatBreak` / `AstStatContinue` dispatch; `Compiler/src/ConstantFolding.cpp`
  for string constant folding; `Compiler/src/CostModel.cpp` for the distinct
  interpolation/call costs; `VM/src/lvmexecute.cpp` for NAMECALL/CALL behavior.
- Rosetta `80f3c13ce48dc3318d5d49f54958f580937ca8aa`, `src/quality.rs`,
  for the diagnostic token similarity measurement.

No reference implementation code was copied or adapted. The implementation uses
the existing TypeScript AST, scalar printer contexts and natural-loop CFG.

## Terminating predicates

The early-continue cleanup previously rewrote a trailing `if selected then
work; break end` into `if not selected then continue end; work; break`. The
new presentation leaves an explicit `break` or `return` inside its predicate.
Ordinary guards around work that continues an iteration retain their existing
behavior. No expression moves between iterations, and locals introduced by the
terminating arm retain its lexical scope.

## Scalar percent-star formatting

The printer can present a scalar literal-receiver `("%*"):format(value)` as an
interpolated string when it proves the following properties:

- The format contains only `%*` slots and `%%` literal percent escapes, with
  exactly one argument per slot. Other conversions and malformed/extra/missing
  slots retain the original method call.
- The surrounding syntax demands exactly one result. Open return/list tails,
  fixed multiple assignments and discarded call statements retain their call
  protocol. Existing parenthesized scalar calls keep a group where a primary
  expression requires it.
- No argument can become a compiler-folded string constant. Interpolation folds
  those strings into the format and removes arguments, which a replacement
  `format` method can observe. Identifiers, calls, concatenations and uncertain
  conditional/logical operands decline. This is a compiler-constant proof,
  not a claim about the runtime type or a trusted inferred annotation.

Both pinned compilers evaluate the literal receiver, evaluate scalar arguments,
then perform NAMECALL and CALL. Late changes to `format` during argument
evaluation therefore preserve lookup order. The method remains observable;
this does not assume the standard library is immutable. Global `string.format`
is not converted. `interpolatedStrings: false` disables this presentation.

Table-valued interpolation needs parentheses: Luau rejects adjacent `{{` in
an interpolated string. Independent review found this parser failure in all
12 profiles of its control. The printer now emits `{({ marker = 11 })}` and
preserves the unchanged first failures alongside the corrected round trips.

Interpolation and method calls have different compiler cost estimates. Existing
call-boundary presentation remains in place; the independent review exercises
20 helper sizes with a replacement method observing caller names, as well as
table/function arguments, bytes and zero/nil/multiple results.

## A continuing repeat path owns its environment

The project-authored controls exposed a preexisting CFG failure independently of
the presentation changes. Consider an effectful exit followed by an effectful
`until` condition. A natural loop excludes the exit arm because that arm never
reaches its backedge. Reconstructing it as one side of a generic diamond put
the condition setup inside the other side, then restored the register environment
from before the split. A reused callee register held the earlier boolean result,
so reconstruction produced the equivalent of `mark(...)(...)`.

`tryIf` now recognizes an outside arm already proven by `hasExternalExitWork`
to be linear, acyclic and terminating at the loop follow or a return. That arm
becomes an exit guard. The continuing arm stays in the surrounding loop scope
and supplies the actual reaching definitions for the subsequent condition.
The guard's register, pending-constructor, emitted-instruction and phi state
cannot leak into the continuing edge. Its allocated lexical names remain
reserved. Loop-tail routing, open packs and unfinished constructors decline
this bounded path. Branching/reentering outside regions retain existing handling.

This follows the official repeat compiler's rule that body locals remain live
through condition evaluation. It also preserves the distinction between a
within-iteration continuation and an exit that cannot join it.

## Evidence and limits

The source baseline is `fc6e10a` (engine tree equivalent to the previous
`232332339cf07211e791a6a67bd395a2031b20a5` checkpoint). The results and preserved
first failures are in
`benchmarks/results/expression-presentation-2026-11-28`.

| Diagnostic Quick replay | Source similarity | Output/source token ratio |
| --- | ---: | ---: |
| Baseline | 77.49586128999316% | 0.9820264838255064 |
| Guard presentation | 77.51887158877184% | 0.9817020794334772 |
| Guard plus scalar format presentation | 77.54150941258385% | 0.9784328425856433 |
| Final including repeat repair | 77.54035791437101% | 0.978417229179775 |

Each diagnostic replay reconstructs all 882 cached inputs without a decompile
failure and uses the unchanged Rosetta quality scorer. These are **not behavior
passes**: replay does not execute the resulting programs. The final change gains
0.04449662437785 percentage points against this turn's baseline. The repeat
repair slightly lowers the presentation score while repairing valid execution
controls; it is retained for correctness.

Original sources, both compiler pins' O0/O1/O2 and g1/g2 inputs, and SHA-256
manifests are under `tests/fixtures/loop-exit-guards` and
`tests/fixtures/format-interpolation`. The complete native comparison has
48 inputs: baseline 36/48, candidate 48/48. It compares exact stdout/stderr and
successful compile/runtime exit codes. Controls include call ordering, captures,
nil/multiple return arity, NaN/comparison effects, mutable method lookup, string
bytes and observable caller frames. Independent loop review additionally covers
existing REF cells, a captured body cell closed on exit, exit-only writes read
after the loop, and two guards sharing an exit body. Its first baseline and
candidate results were both 12/12. These controls are now development regressions.

The initial loop source had an invalid table comparison in its observation
itself. That sealed source and all 12 original inputs remain unchanged; its
runtime failure is not counted as an engine regression. A separately named
completed source fixed the observation before sealing new inputs and then
exposed the repeat environment error in all 12 profiles. Both first results
remain in the evidence archive.

Local verification used Node 24: full suite 159 files / 1970 tests passed before
adding the 24 independent review inputs; the resulting format/loop suites passed
all 77 tests separately. Node 20/22, full official parser/runtime gates and strict
Rosetta are integration requirements, not claimed by these diagnostics.

Reproduce the native controls with a fresh output directory:

```sh
python scripts/verify-expression-presentation.py \
  --engine "$ENGINE_CHECKOUT" --baseline-dist "$BASELINE_DIST" \
  --luau-ci "$LUAU_9D_CHECKOUT" --luau-rosetta "$LUAU_C875_CHECKOUT" \
  --out "$FRESH_OUTPUT"
```

The script builds the small test host against each pinned official VM. Its
`replace_format` support intentionally makes the actual string method mutable
for observability controls; the generated source receives no special treatment.
