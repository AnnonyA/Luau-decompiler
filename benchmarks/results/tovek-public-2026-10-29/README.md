# Tovek public corpus
Revision: 77edf387bf280a2f4d46d57ac85d5c4f071b763f

Paired-source observations are separate from bytecode equivalence; parser PASS is not semantic MATCH.

| Input | Version | Decode | Parser | Source observation |
|---|---:|---|---|---|
| docs/assets/v26/tovek/samples/ClickToMoveController.luaubc | 14 | PASS | PASS | NO MEDIDO |
| docs/assets/v26/tovek/samples/Promise.luaubc | 14 | PASS | PASS | NO MEDIDO |
| docs/assets/v26/tovek/samples/Signal.luaubc | 14 | PASS | PASS | NO MEDIDO |
| docs/assets/v26/tovek/samples/SpawnShield.client.txt | 14 | PASS | PASS | NO MEDIDO |
| docs/assets/v26/tovek/samples/SpawnShield.luaubc | 14 | PASS | PASS | NO MEDIDO |
| docs/assets/v26/tovek/samples/Store.luaubc | 14 | PASS | PASS | NO MEDIDO |
| docs/assets/v26/tovek/samples/Trove.luaubc | 14 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/arithmetic_result_fold.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/branch_constructor_initialized.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/cache_context.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/cell_swap_beside_copy.luaubc | 9 | PASS | PASS | MATCH |
| luau-lifter/tests/fixtures/closure_captured_nil_init.luaubc | 11 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/collapsed_conditional_stays_ssa.luaubc | 9 | PASS | PASS | MATCH |
| luau-lifter/tests/fixtures/dead_self_update.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/deinline_budget.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/deinline_declared_prefix.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/deinline_declared_select.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/deinline_fall_off.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/deinline_first_read.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/deinline_first_read_statement.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/deinline_guard_select.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/deinline_local_tuple.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/deinline_outer_anchor.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/deinline_specialized_shorter.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/duptable_template.luaubc | 9 | PASS | PASS | MATCH |
| luau-lifter/tests/fixtures/events_shared_return.luaubc | 13 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/fastcall_arguments.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/fresh_closure_o1_without_dupclosure.luaubc | 9 | PASS | PASS | MISMATCH |
| luau-lifter/tests/fixtures/generic_for_local.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/iteration_cell.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/library_constants.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/locals_over_limit_distinct_names.luaubc | 9 | PASS | PASS | MISMATCH |
| luau-lifter/tests/fixtures/locals_over_limit_same_name.luaubc | 9 | PASS | PASS | MISMATCH |
| luau-lifter/tests/fixtures/long_elseif_chain.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/loop_return_skips_loop_tail.luaubc | 9 | PASS | PASS | MISMATCH |
| luau-lifter/tests/fixtures/loop_shared_return.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/module_methods.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/numeric_loop_return.luaubc | 9 | PASS | FAIL | INVALID |
| luau-lifter/tests/fixtures/register_phi_webs.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/return_guard.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/setlist_index_gap.luaubc | 9 | PASS | PASS | MATCH |
| luau-lifter/tests/fixtures/shared_return_tail.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/template_repeated_key.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/traceback_helper.luaubc | 9 | PASS | PASS | MATCH |
| luau-lifter/tests/fixtures/ui_tree_branch_scope.luaubc | 9 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/upvalue_analysis_nested.luaubc | 11 | PASS | PASS | NO MEDIDO |
| luau-lifter/tests/fixtures/upvalue_analysis_nested_g0.luaubc | 11 | PASS | PASS | NO MEDIDO |

## Interpretation and remaining failures

All 47 inputs decode; 46 outputs pass the official parser. The six v14 web samples
plus the Roblox Base64 transport parse successfully. The initial official-only
scan mislabeled the v13 Roblox-encoded events fixture; the pinned adapter now uses
its correct encoding without changing its bytes.

Of 35 paired-source observations, 5 MATCH, 4 MISMATCH, 1 INVALID and 25 are NO
MEDIDO. Twelve additional inputs have no paired execution here. The current VM
runs published source, not the legacy bytecode, so these are triage observations,
not independent semantic certification of every bytecode. The web modules need
Roblox dependencies and have no runtime equivalence claim.

- `cell_swap_beside_copy`: MISMATCH before the new pre-branch snapshot correction,
  MATCH afterward. The old copied value was being replaced by the mutated cell.
- `fresh_closure_o1_without_dupclosure`: distinct closures become shared after
  reconstructed source is compiled; the identity comparison changes false to true.
- `locals_over_limit_same_name` and `locals_over_limit_distinct_names`: syntax
  parses, but compilation/execution exceeds Luau's 200-local register limit.
- `loop_return_skips_loop_tail`: inlined loop exits execute the wrong tail; result
  counts and side-effect traces differ.
- `numeric_loop_return`: loop continuation regions contain statements after an
  unconditional break and fail parsing. Result bindings/default-return paths also
  require correction; hiding the syntax error would not establish equivalence.

`first-syntax.json` and `first-source-observations.json` preserve the first scan.
`report.json` records the final scan after the snapshot correction and proper
encoding selection. Optimization O1 is recorded for the published O1 closure and
local-limit fixtures. No competitor API calls or source modifications were used.
These now-observed fixtures must not be presented as future blind evaluations.

Reproduce with the command in [TOVEK.md](../../TOVEK.md). The runner exits nonzero
while any decode, parser, AST or observed semantic failure remains. These failures
keep the feature PR open; green existing CI is not treated as a passing new corpus.
