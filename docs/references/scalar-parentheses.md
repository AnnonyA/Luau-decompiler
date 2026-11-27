# Scalar call spelling and iterator result arity

This change is independently implemented in the existing TypeScript printer
and reconstructor. It distinguishes the AST's one-result adjustment from the
parentheses needed to express that adjustment in each source context.

## Pinned references

- [Tovek ce2ea332, formatter.rs](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/formatter.rs):
  `format_rvalue_inner`, `needs_truncation_parens`, `format_spread_tail`, and
  `format_filling_tail` distinguish ordinary expressions, spreading tails,
  and fixed result lists. Its `Select` representation differs from our
  explicit `paren` adjustment. The MIT license was inspected; no Rust source
  was copied or adapted.
- [Official Luau c87565b8, Compiler.cpp](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/Compiler.cpp):
  `compileExpr` compiles a group into the same single target;
  `compileExprListTemp` distinguishes exactly filled lists from filling tails;
  `compileExprCall`, `compileStatReturn`, and `compileExprTable` expand only
  eligible final expressions; `compileExprIfElse` compiles each branch into
  one target. The iterator initializer supplies three slots.

## Printer boundary

The printer omits outer `paren` nodes around calls, method calls, and varargs
only where the enclosing context already requests one value. These include
operator operands, tests, conditional-expression branches, keyed constructor
fields, numeric loop bounds, non-final list items, and assignment lists with
exactly as many expressions as destinations. The AST remains unchanged.

A final argument, return value, positional constructor field, generic iterator
value, or assignment value that must fill additional destinations retains its
adjustment. A zero-result call consequently remains one nil where required;
nil-containing result packs retain their arity. Other parentheses remain,
including operator grouping, callee boundaries, explicit closure identity
protection, and function-literal grouping that can affect debug names.

## Scalar iterator regression discovered by the control

The new authored source exposed an existing error in the f60a031 baseline:
`for key, value in (iterator()) do` reopened the factory's results after the
reconstructor dropped its explicit nil state/control slots. A returned extra
state reached the iterator even though the input bytecode requested one result.
Both the baseline and the initial printer-only candidate failed the same eight
O0/O1 normal/hard profiles; all four O2 profiles passed. Those first results
and both representative outputs are retained without modification.

The reconstructor now defers a generic-loop call only when it requests exactly
three results and SSA proves that the loop consumes all three from the same
producer. Header compaction uses the same proof. Otherwise each input register
remains a scalar value, including the new last expression after explicit nil
slots are removed. Two-result or larger result lists use the existing fixed
declaration machinery. The unchanged control now passes all twelve profiles.

## Validation and measurement

`tests/fixtures/scalar-parentheses/observations.luau` observes zero/one/many
results, nil gaps, assignments, argument/return tails, constructor order,
method receiver identity, generic iterator state, numeric bounds, varargs,
conditionals, captured table identity, function debug names, and effect order.
Its original source and twelve normal/hard bytecodes are SHA-256 sealed.
The focused unit suite also checks AST immutability and every protected tail.
The older conditional-return assertion now verifies that both AST adjustments
remain, while allowing their redundant printed parentheses to disappear.

On the same 882 cached Quick inputs, unmodified Rosetta quality scoring changes
from 76.419040% at f60a031 to 76.431142%, with the geometric token ratio moving
from 1.004873 to 1.002157. The output has 3,988 fewer tokens. Similarity improves
on 339 profiles and declines slightly on 281 because the original source can
also contain optional grouping; this general source spelling does not inspect
benchmark IDs or source text. The iterator correction changes none of those
882 outputs, and its new behavioral control remains an independent regression.

Raw first/final authored results, native Quick/hard behavior results, raw
882-profile scores, and unit logs are recorded in
`benchmarks/results/scalar-parentheses-2026-11-27`. Rescoring alone does not
establish behavioral equivalence; the VM and unit results provide separate
checks. All 1,419 unit tests in 140 files pass. The unchanged native Rosetta
check over all 147 Quick-selected sources passes all 1,764 normal/hard profile
combinations, using the original library harnesses and exact generated/mutant
source selection. Strict release tier and required CI gates belong to the
integrated engine's release validation.
