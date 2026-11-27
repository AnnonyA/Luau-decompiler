# Returning guards and classifier ladders

The new structural cases are independently implemented in
`StructureRefinement.ts`, reusing the existing scope, exact-node comparison,
exit, and NaN-safe negation helpers. No benchmark source or case identity is
consulted by the engine.

## References inspected

- [Tovek ce2ea332, recover_guard_continue.rs](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/recover_guard_continue.rs)
  describes why equal terminal guards can share a short-circuit condition,
  and why ordering comparisons must retain explicit negation for NaN.
  [flatten_guards.rs](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/flatten_guards.rs)
  separates exit orientation from scope-sensitive body movement. The pinned
  MIT license was inspected; no implementation was copied or adapted.
- [Official Luau c87565b8, Compiler.cpp](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/Compiler.cpp)
  implements short-circuit `compileConditionValue` and the exact equality
  complement in `getJumpOpCompare`.
  [lvmexecute.cpp](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/VM/src/lvmexecute.cpp)
  dispatches `JUMPIFEQ` and `JUMPIFNOTEQ` as complements, including their
  primitive and equality-metamethod paths.

## Bounded rewrites

Adjacent one-sided guards containing exactly the same `return` are joined
with `or`. The predicates retain their order and run under the same conditions;
the selected return tuple is unchanged. A returned function literal, including
one inside a constructor, prevents the merge so separate creation sites cannot
be conflated. At most six disjuncts are joined. Break and continue guards retain
their existing presentation.

Three or more consecutive guards that return values can form an `elseif`
ladder. Their original branch bodies and return expressions remain intact, so
open calls, scalar calls, empty result packs and nil gaps retain their arity.
A following return becomes the fallback branch. This rewrite neither creates
conditional return expressions nor moves declarations between branches.

When two terminal paths contain a short return and a larger body, the short
return can precede the larger body as a guard. This is allowed only under the
existing scope proof, and only when the new test introduces no additional
negation cost. A detached final return uses the same condition and scope rules.
This recovers a classifier's last positive condition without wrapping its
remaining cases in a negated outer branch.

Finally, `not (a == b)` and `not (a ~= b)` become their exact complementary
comparisons, including immediately after conditional-to-boolean recovery.
Relational operators retain `not`; no ordered comparison is inverted.

## Observations

The new source `tests/fixtures/terminal-guards/observations.luau` observes
predicate order, short-circuit behavior, nil-containing return packs, open
returns, shared table identity, captured cells, distinct closure sites,
`__eq` effects, NaN comparisons, and loop exits. The unchanged source passes
all twelve normal/hard profiles in both the baseline and candidate. Its mean
similarity changes from 76.7% to 77.8% with a smaller output. The source and
bytecodes are SHA-256 sealed.

The independent unit executor compares original and refined terminal ASTs for
all 36 pairs of Lua truthiness values, including false, nil, zero, the empty
string and a table. Additional controls preserve return pack arity, local
shadowing, repeat-condition visibility, function creation sites, and all
six comparisons across NaN and ordinary numbers. All 1,439 unit tests in
141 files pass, with no changes to existing test assertions.

Exact 882-profile Quick rescoring changes from 76.431142% at 12a6561 to
76.505895%, and geometric token ratio from 1.002157 to 1.000300: 3,470 fewer
output tokens. 340 profiles improve and 298 decline slightly, reflecting
source spelling choices that bytecode alone cannot distinguish. Classifier
families benefit most; selected seed1460 profiles gain approximately
1.3–1.48 percentage points. The engine contains no case-specific rule.

The unchanged native Rosetta check over all 147 Quick-selected sources passes
all 1,764 normal/hard combinations, with original library harnesses and the
exact generated/mutant selection. Raw first/final authored results, both
initial unit observations, final unit log, raw quality scores, and the native
behavior report are under
`benchmarks/results/terminal-guards-2026-11-27`. The initial prototype merged
break guards too; that was narrowed to returns, leaving the existing break
assertion intact. The new fixture's first unit expectation also omitted O2's
constant folding of `math.huge`; that expectation was corrected while the
source, bytecodes and successful VM results stayed unchanged.
