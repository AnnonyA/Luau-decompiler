# Private parallel indexed assignments

The independent AST pass recovers adjacent indexed writes whose scalar results
were computed as one contiguous run of private, single-use bytecode temporaries.
The recovered assignment keeps the existing target and value order. Existing
temporary folding can then restore destination reads before RHS reads without
moving an effect across another effect.

## Measured result

The diagnostic replay uses the unchanged 882 Quick bytecodes and exact Rosetta
token scorer, default options, and Node 22.23.5. Relative to main `36a344e`:

| Measurement | Before | After |
| --- | ---: | ---: |
| Source similarity | 76.9282709511% | 77.0847657708% |
| Normalized token ratio | 0.9927495865 | 0.9908493704 |
| Local ratio | 1.0963497723 | 1.0874242389 |

64 profiles improve, 818 remain equal, and none decrease. This is a source-form
measurement, not a behavioral pass for the whole Rosetta suite. The four strict
tiers remain an integration gate. The complete diagnostic distribution is in
[quick-diagnostic.json](quick-diagnostic.json).

The first project-authored check passed 36/36 profiles with each engine:
O0/O1/O2 at g1/g2 and six corresponding Hard profiles. A separate official-VM
comparison executed the exact saved bytes given to each engine, then recompiled
and executed its output: 72/72 matching observations across both engines, with
normal return required. Neither an exit code alone nor source re-execution was
accepted as equivalence. Sources and all 36 inputs are sealed in
[the fixture manifest](../../../tests/fixtures/parallel-assignments/manifest.json).
See [the first check](authored-initial.json),
[saved-bytecode results](saved-bytecode-summary.json), and
[byte-exact traces](saved-bytecode-traces.json).

## Safety and supported scope

- Every RHS is one immutable, uncaptured, single-read scalar scratch binding
  with bytecode ownership and no exact debug declaration. Producers must be
  adjacent, in the same function, and in the same order as the stores.
- Destination operands are literals or resolved local cells that a store's
  metamethod cannot mutate. Global reads, computed effects, and mutable captured
  cells are excluded. Indexed writes retain their left-to-right order, including
  aliases; local/global assignment targets are excluded.
- The pass joins at most eight writes. It adds no binding or expression
  evaluation. Call, method-call, and vararg scalars retain their adjustment when
  folded by the existing pass. Explicit caller-protected declarations remain.
- The feature follows `fold_single_use_temps=false`. Unknown AST provenance,
  interleaved statements, reversed producers, and open tuple producers remain
  unchanged.

The authored fixtures observe destination/key reads, aliased stores,
`__index`/`__newindex` order, an RHS that changes target/key cells, zero and
multiple returns, saved closures, and table/capture identity after a loop.
All normal compiler profiles exercise recovery. Two Hard layouts insert
interstitial statements and conservatively retain their temporary form; their
behavior and AST validation still pass. The initial overly broad shape
assertion is preserved in [its original log](initial-shape-assertion.log).

## Shared-node review regression

A later independent AST review found that a single identifier object reused in
two lexical scopes could inherit the last binding's mutability proof. The
control shares a destination node between a mutable captured parameter and an
unrelated immutable parameter. The original pass incorrectly joined its two
stores ([first focused result](shared-node-review-first.log)). Ambiguous node
identities now fail closed instead of selecting either binding. The complete
parallel-assignment test file passes **27/27** after that guard
([final focused result](shared-node-review-final.log)). This is a synthetic AST
regression, separate from the original bytecode runtime observations above.

## Engineering references

Inspected Tovek at
[`ce2ea332`](https://github.com/Kiet1308/Tovek/tree/ce2ea3325547fa3896f274b68013386338039040),
particularly `ast/src/copy_cleanup.rs` and `ast/src/inline_temps.rs`, for the
whole-binding capture/writer invariant. Its MIT license was verified. The pass
is independently implemented in our TypeScript AST; no Rust code was copied.

Official Luau
[`9d7748a4` `compileStatAssign`](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/Compiler.cpp)
and the matching Rosetta Luau 0.747 compiler evaluate indexed LHS operands before
RHS values and write nonlocal destinations from left to right. Local targets
can be assigned during RHS evaluation or in a separate conflict-resolution pass,
which is why this bounded recovery excludes them. `compileExprListTemp` and
`compileExprTempN` establish the scalar/open-result distinction.
