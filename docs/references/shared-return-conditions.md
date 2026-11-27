# Sharing the continuation of returning guards

The compiler does not emit a jump over an `else` after a branch that always
returns. Several false edges of an `and` condition can consequently reach the
same next alternative, without that next alternative post-dominating the
condition: the successful path returns first. Requiring a post-dominator for
every function-level join duplicated that shared continuation into each
alternative. A sequence of compound `elseif` tests could expand exponentially.

The reconstructor now recognizes a bounded additional join. Both arms must
reach it, and every path that avoids it must terminate in a real `RETURN`.
The proof walks an acyclic prefix; it rejects loop regions, another enclosing
region's stop, already emitted blocks, overlapping arm prefixes, and ambiguous
terminal blocks. It additionally rejects incoming SSA phis, definitions of
registers live at the join, and closure creation, capture or close instructions
in either prefix. Ordinary branch emission still preserves all evaluations and
their order. This is deliberately narrower than general shared-tail recovery.

References inspected:

- Tovek `ce2ea3325547fa3896f274b68013386338039040`,
  [`restructure/src/region.rs`](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/restructure/src/region.rs),
  especially `shared_tail_join`, `build_conditional`, and
  `conditional_arms_join`; MIT, Jujhar Singh and Mathias Pedersen (2024).
- Official Luau `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`,
  [`Compiler/src/Compiler.cpp`](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/Compiler.cpp),
  `compileStatIf` and `compileConditionValue`.

The TypeScript implementation independently applies these control-flow
invariants to the existing CFG, liveness and SSA; no Rust code was copied.

## Evidence

The project-authored `ordered-classifier` fixture records each short-circuit
predicate, returns three values including a nil slot, exercises an enclosing
stop, observes captured cells across assignments, and protects returns from
inside loops. Before and after both pass all six normal and six hard profiles
in the unchanged pinned Rosetta VM. Its mean token similarity improves from
27.1414% to 68.7721%, and token size ratio from 5.7134 to 1.5157. The original
source and twelve bytecodes are sealed by SHA-256 in
`tests/fixtures/shared-return-conditions/manifest.json`.

Previously observed Rosetta generated cases 1178 and 1154 pass all 24 normal
and hard profiles with this change. For seed1178/O0g1, the original has 3,953
tokens: output shrinks from 18,163 to 3,689, and similarity rises from 25.014%
to 72.023%. These are development regressions, not independent unseen results.

Rescoring the exact 882 cached Quick inputs with the unchanged Rosetta token
metric gives 72.29585% to 73.29564% mean similarity, and size ratio 1.10003 to
1.06624. This includes the separately verified loop-condition change and is
not, by itself, a behavioral benchmark. Raw per-profile scores, summary,
source hashes and VM reports are in
`benchmarks/results/shared-return-conditions-2026-11-27`.

The native `rosetta check` run over all 147 Quick-selected sources, including
the original library harnesses, passes all 1,764 combinations of the six normal
and six hard profiles. The 100 generated/mutant source hashes are recorded in
`coverage.json`. This diagnostic has the complete selected input coverage;
the strict tier wrappers are reserved for the later integrated release.
All 1,357 unit tests in 136 files pass on this engine revision.

The preexisting `pr58-tables-terminals` fixture is unchanged. Its assertion
required the common return to sit in an `else`, which would require the
duplication this change removes. The replacement executes the reconstructed
conditional for all 36 pairs of false, nil, true, zero, empty string and table
values, checking the exact return tuple. A lost shared terminal now fails on
its actual behavior rather than only its AST placement.
