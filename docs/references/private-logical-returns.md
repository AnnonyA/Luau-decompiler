# Private result cells at a logical return

A compiler can lower `first and second and value` into a result register,
conditional stores, and repeated returns of that register. A private lexical
temporary introduced during reconstruction can retain that shape even after
ordinary adjacent temporary folding. The new bounded pass restores the
logical value when every read and store in the terminal region has an explicit
proof.

## Rules

The candidate begins with one local declaration and ends with a truthiness
guard followed by a return of that same cell. The selected path may assign a
new value, enter another such guard, or choose between scalar terminal values.
Only these forms are consumed; other statements, residual cell reads,
parallel writes, loops, open return packs, and function literals decline.
The parser has a fixed work budget.

The cell must be uncaptured, resolved by its declaration identity. An unrelated
captured local with the same spelling neither authorizes nor blocks the proof.
Every input that is tested and can be replaced later must be a primitive
literal or a read of an unchanged, uncaptured parameter of its own function.
Globals, ordinary locals, allocated tables, properties and calls do not qualify
as intermediate backing values. No annotation or inferred name is used as
type evidence.

That restriction also addresses reference lifetime: a parameter supplies a
separate retained reference when the temporary alias disappears. The pinned
compiler's `ValueTracking` gives ordinary local declarations an owner block;
parameter tracking initializes their value without assigning such an owner.
`popStatLocals` releases eligible variables only when that owner equals the
current block. Its inlining argument setup changes initializers but does not
assign a new owner. This retains the parameter's backing reference in both
the original statement sequence and the reconstructed expression; it is not
only a claim about a read in the new return. Both pinned versions below have
this policy. Return expressions allocate a separate temporary, and logical
evaluation uses that target without overwriting the parameter. In addition,
the reconstructed expression reads its inputs
within one `RETURN`, without a statement boundary between those reads and the
selected terminal value. The rule is intentionally not generalized to all
lexically scoped locals.

An assignment immediately followed by a return of the cell requests exactly
one value, so a final assigned call or vararg retains its scalar adjustment.
An already open `return f()` or `return ...` is rejected. Selected properties
and final calls remain at their original evaluation points, and existing
callee boundaries remain intact. No helper call or function frame is created,
removed, or inferred by this pass.

Late folding and naming can expose the pattern after the first structural
pass. A final `recoverPrivateLogicalReturns` traversal revisits only this proof.
It runs only when conditional expressions are enabled, preserving the user's
option to keep them disabled.

## Pinned references

- [Tovek ce2ea332, conditional_expressions.rs](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/conditional_expressions.rs):
  `fold_self_guards`, branch value chains, and capture checks distinguish
  exact logical values from boolean-only rewrites. The MIT license was
  inspected. This TypeScript terminal-region parser and its parameter
  restriction were independently implemented; no Rust implementation was
  copied or adapted.
- [Official Luau c87565b8, Compiler.cpp](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/Compiler.cpp):
  `compileExprAndOr`, `compileConditionValue`, `compileExprIfElse`,
  `compileStatAssign`, `compileStatReturn`, and `popStatLocals` establish
  evaluation, adjustment, and statement-boundary rules.
- [ValueTracking.cpp](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/ValueTracking.cpp)
  and [ValueTracking.h](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/ValueTracking.h)
  define the owner and last-use information. The proof depends on these pinned
  compiler behaviors rather than assuming all parameters have a universal
  lifetime guarantee in every future compiler.
- The CI pin [9d7748a4, Compiler.cpp](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/Compiler.cpp),
  [ValueTracking.cpp](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/ValueTracking.cpp)
  and [ValueTracking.h](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/ValueTracking.h)
  were checked independently: `Variable.owner` starts null, the function
  visitor initializes parameters without setting it, inlining changes only
  their initializer or constant state, and `popStatLocals` requires the current
  owner block. The same restricted backing-reference argument applies.

## Observations

The authored source exercises both `and` and `or` across false, nil, true, zero,
the empty string, a shared table, and a function. It records property effects,
selected value identity, captured result cells, mutable captured inputs,
effectful intermediate producers, open four-result returns with nil gaps,
separate closure sites, and function debug names. Its original source and
twelve normal/hard bytecodes are SHA-256 sealed in
`tests/fixtures/private-logical-returns`.

The independent unit evaluator checks 784 combinations of input values,
selection mode, forced values and logical operator, including the exact
number of property reads. Additional controls decline ordinary local inputs,
unknown producers, captured or overwritten inputs, residual cell reads, open
packs and function creation. Assigned final calls returning zero or multiple
values remain scalar. The options test verifies the resulting AST and its
resolved guard binding rather than relying on a generated local's spelling.

Both engines pass all twelve normal/hard authored profiles; the candidate
raises mean similarity from approximately 79.8% to 80.2%. On the exact 882
Quick inputs, similarity changes from 76.505895% at 8472145 to 76.581730%,
and the geometric token ratio changes from 1.000300 to 0.999065. The parameter
restriction produces exactly the same 882 outputs as the exploratory broader
local-input proof, which was discarded before final behavior validation.
The final suite passes 1,459 tests in 142 files. The native Rosetta diagnostic
run passes all 1,764 normal/hard profiles for the exact Quick source selection,
with no output mismatch, recompile failure, or decompiler failure.

Raw authored results, first/final unit observations, complete Quick/hard
behavior results, raw per-profile scores, and hashes are stored in
`benchmarks/results/private-logical-returns-2026-11-27`. These measurements
describe the tested source/profile selections; they do not claim recovery of
compiler-erased source or a general de-inliner.
