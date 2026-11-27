# Smaller source forms for preserved calls

References inspected for this independently implemented printer change:

- Tovek [`ce2ea3325547fa3896f274b68013386338039040`](https://github.com/Kiet1308/Tovek/tree/ce2ea3325547fa3896f274b68013386338039040),
  `ast/src/closure_identity.rs` and `ast/src/deinline_safety.rs` (MIT):
  closure constants retain their original owner and calls can observe frames,
  environments, captures and argument snapshots.
- Official Luau [`9d7748a4f324213a18cb8283fa2a77c330225fa0`](https://github.com/luau-lang/luau/tree/9d7748a4f324213a18cb8283fa2a77c330225fa0)
  and [`c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`](https://github.com/luau-lang/luau/tree/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f),
  `Compiler/src/Compiler.cpp::getFunctionExpr`, `compileExprCall`, and
  `Compiler/src/Builtins.cpp::getBuiltin`.

The original boundary `(if true then callee else nil)(arguments)` prevents a
new optimization from removing an original CALL. Both official revisions
stop function-literal and builtin resolution at binary expressions too. We
can therefore print `(true and callee)(arguments)` with the same boundary.
The left operand is always true; the callee is evaluated exactly once, before
the arguments, and contributes exactly one value. The invocation's argument
and result packs remain unchanged. False and nil callees keep their values
and error categories. Lower-precedence callees are grouped inside the fence.
No binding is made mutable and no extra closure or table is allocated.

This does not remove `preserveBoundary`, make optional if-expression recovery
mandatory, or infer that an arbitrary callee is pure. The special inline
factory path keeps its existing scalar adjustment and bypasses the fence.

The project-authored
[`call-fence-observations.luau`](../../tests/fixtures/quality/call-fence-observations.luau)
checks mutable captured state, factory identity, an observable `__index`,
callee/argument evaluation counts, open arguments, nil-bearing multiple
results and false/nil call errors. Its six O0/O1/O2 × g1/g2 bytecodes run in
official Luau `c87565b8`; both the frozen prior engine and the new printer
match the exact original observations in all six profiles. Original bytes,
both unedited outputs, recompilations, hashes and traces are retained in
[`call-fence-2026-11-27`](../../benchmarks/results/call-fence-2026-11-27/summary.json).
The narrower printer tests also check alternative-callee precedence and
retention of the original closure boundary metadata.

A diagnostic replay of all 246 manual-case profiles in pinned Rosetta
`80f3c13ce48dc3318d5d49f54958f580937ca8aa` improved mean token similarity from
78.9444594% to 80.6492906% and the geometric token-size ratio from 1.1656937 to
1.1221388. This is a category measurement, not a claim about the entire suite
or the subsequent integrated engine. Full release results are recorded
separately after the unchanged behavioral gates run.

## Grouping calls whose callee cannot expose a literal

The final AST now has a lexical check before printing a boundary. An unknown
runtime value, a parameter, a global, a rewritten local or a non-literal
initializer cannot become an inlineable function through `getFunctionExpr`.
For those values, `(callee)(arguments)` is enough: `getBuiltin` does not unwrap
an `AstExprGroup`, so the original indirect call still cannot turn into a new
builtin fold or FASTCALL. Immutable literal aliases and fields of local table
constructors keep the stronger `(true and callee)` fence. Ambiguous bindings
and the analysis work limit also keep it. Variadic functions retain their
signature and cannot be inlined by either pinned compiler revision.

The check runs after naming, scope bounding and cleanup, because those passes
can expose a constructor or function initializer. It uses resolved identifier
nodes rather than names and leaves every `preserveBoundary` flag intact. The
same six independent call-order/capture/arity profiles pass with grouping;
their separate observations are retained in
[`call-boundary-groups-2026-11-27`](../../benchmarks/results/call-boundary-groups-2026-11-27/summary.json).

## Constant string fields and anonymous function names

A valid constant string key can use record syntax (`code = value`) without
changing key evaluation, field order or its value. Function literals need an
additional constraint: official `Ast/src/Parser.cpp::parseTableConstructor`
assigns a record's field name to a directly contained function literal. The
printer therefore retains bracket syntax for an anonymous function; named
function literals use record syntax only when their recorded name agrees.

The independent
[`table-key-debug-observations.luau`](../../tests/fixtures/quality/table-key-debug-observations.luau)
also revealed an existing failure in every O0/O1/O2 × g1/g2 profile. Method
lifting changed an anonymous table closure into `function table.run`, and O0
local-function lifting could give it another invented name. Both operations
now require appropriate original name evidence. Scalar fields still use the
shorter spelling, while anonymous functions retain their observable empty
debug name. The original counter/field/call traces were otherwise unchanged.

The first observation (baseline **0/6**, first candidate **0/6**) is retained
in [`table-key-presentation-2026-11-27`](../../benchmarks/results/table-key-presentation-2026-11-27/summary.json).
After the name repair the unchanged originals pass **6/6** in the candidate;
the baseline still fails **0/6** in the
[`fixed` comparison](../../benchmarks/results/table-key-presentation-2026-11-27/fixed/summary.json).
The report's combined `allPass` includes the old engine and is consequently
false; the per-engine `match` fields retain that distinction. These observed
programs are now development regressions, not blind evaluations.
