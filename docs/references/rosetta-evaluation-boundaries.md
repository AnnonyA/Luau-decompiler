# Selected-value preludes and bounded open-call reads

References inspected:

- Tovek `ce2ea3325547fa3896f274b68013386338039040`, MIT,
  `ast/src/side_effects.rs`: an evaluation is observable when it may call user
  code or raise, even if its result is unused. `is_total_pure` and
  `is_observable` separate those questions from ordinary value liveness.
- Official Luau 0.747 `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`,
  `VM/src/lvmexecute.cpp`, CALL, POW and MINUS dispatch: calls execute even when
  their returned value is dead, while arithmetic retains its original order
  and metamethod/error behavior.

This independently implemented repair keeps ordinary statements emitted by a
successful selected-value guard walk outside the value-only dry-run mode.
Discarded calls and property/arithmetic evaluations consequently retain their
evaluation points. If the selected register is read in the prelude before the
final guard, the speculative rewrite declines: removing its declaration could
move its evaluation past another effect or exception.

The use census also distinguishes an open CALL with a decoded fixed prefix and
tail producer from an unknown frame top. A known tail does not read stale higher
registers. Counting those registers as arguments falsely deferred a loop-local
call until a later unrelated consumer and then silently lost it. Unknown tops
retain the conservative fallback. No reference source was copied.

The project-authored sources in `tests/fixtures/rosetta-evaluation` preserve the
first failures before repair. `unused-call-before-guard` passed 4/6 profiles;
`unused-loop-call-before-pack` passed 2/6; both now pass all six. The selected
prelude reproduction passed 4/6 before and 6/6 afterward. Arithmetic error order
and ordered field observations are additional passing controls. Bytecode hashes
and reports are retained beside the fixtures and under
`benchmarks/results/rosetta-evaluation-2026-11-27`.

Complete unmodified Rosetta development mutants 25, 298 and 677 pass 18/18
profiles after repair; the separate IIFE regressions 787 and 801 pass 12/12.
These are development regressions, not independent holdout evidence.

## Boolean selection after conservative guard fallback

Declining an unsafe guard walk can expose `if not comparison then false else
true` in the ordinary reconstruction. Tovek's `ast/src/normalize_conditions.rs`
at the revision above distinguishes boolean values from mere truthiness;
official Luau's JUMPIF/JUMPIFNOT and NOT dispatch use the same false/nil test.
The independent cleanup now reduces opposite boolean arms while retaining
boolean coercion for arbitrary values. It evaluates the test once and never
flips an ordering comparison, so NaN remains unordered.

This restores the existing fixed-tuple helper recovery test without weakening
its assertions. A new project-authored runtime control covers nil, false, zero,
empty strings, tables, NaN, exact boolean result types and sixteen observed
calls. It passes all six profiles before and after cleanup. The fixture and
reports are retained under `tests/fixtures/boolean-selections` and
`benchmarks/results/boolean-selections-2026-11-27`.
