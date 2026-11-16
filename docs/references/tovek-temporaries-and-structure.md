# Temporaries, declared locals and statement structure (2026-11-16)

Reference inspected: [Kiet1308/Tovek at ce2ea332](https://github.com/Kiet1308/Tovek/tree/ce2ea3325547fa3896f274b68013386338039040),
MIT license. Files read for this round: `cfg/src/ssa/inline.rs`,
`ast/src/inline_temps.rs`, `ast/src/evaluation_order.rs` (event order),
`ast/src/side_effects.rs` and `ast/src/copy_cleanup.rs`. No Tovek code was
copied; everything below is implemented on our AST. Compiler behaviour was
checked against bytecode listings from the official `luau-compile` 0.747
(`--text`), not against a reading of `Compiler.cpp`.

## What Tovek does

Tovek folds a single-read definition into its reader when it can prove the
evaluation order is unchanged: it walks the reader in evaluation order (callee,
arguments, then the call; receiver, arguments, then the method lookup; target
bases and keys before values) and refuses when an observable evaluation would
come before an observable candidate, or when the read sits in a conditional
arm. Service and `require` handles are never folded. It does not use register
numbers to tell a compiler temporary from a declared local: the only "source
local" evidence is debug info and function names.

## What we implement

`src/ast/TempFolding.ts` uses the same invariant in a stricter form. A
temporary directly before its reader may move into it only when everything the
reader evaluates before that read is inert: literals, reads of bindings that
no closure rewrites, members of Luau/Roblox library tables (resolved by
`GETIMPORT`) and function literals. Reads through `and`/`or` right operands,
if-expression arms, loop tests and nested blocks are never folded into. A call
is not folded into a list tail, where it would keep all its results, except a
lone returned value, which keeps the adjustment with parentheses. Folding
stops at a size limit so a statement still reads as one line.

Related exact rewrites in the same file: `local t = {...}` followed directly by
`t.name = value` becomes one constructor when the value cannot observe the
table; a never-written local that copies another never-written local is
replaced by the original; a literal local with one reader is that literal.

### Declared locals from register use (not in Tovek)

The compiler evaluates a temporary in its consumer's destination register or
above it. A value read as an operand from below the destination already had a
register of its own, so the source declared it. The reconstructor pins such a
value and records its name; neither folding pass removes it. Without debug
info this keeps `local tween = TweenService:Create(...)` followed by
`tween:Play()` apart from `TweenService:Create(...):Play()`, which compile
differently. Bare globals and literals are excluded: they say nothing either
way.

The parameters of a helper that `-O2` expanded in place occupy registers the
same way. Once `InlineRecovery` restores a call, a single-use temporary passed
straight to that helper is folded back as its argument.

### Statement structure

`src/ast/StructureRefinement.ts` chooses between spellings the compiler emits
identically. Luau replaces a jump to a final `return` with the `return`
itself, so the bytecode does not say which arms of a tail `if` returned
explicitly; these are presentation rules, each exact in evaluation and order:

- arms that run the same statements are merged under one condition;
- an arm that leaves is a guard clause and what followed its `else` follows the
  guard, but only when no local's scope is widened past a later statement;
- a bare `return` or `continue` where control arrives anyway is dropped;
- consecutive tail guards are the jumps of one `and` condition, and are
  wrapped back into a positive test when that removes negations;
- `if a then X; continue end; if b then Y end` at a tail is an `elseif` ladder;
- a value assigned across a test (`x = a; if x then x = b end`) is `a and b`.

`src/ast/ClosurePresentation.ts` (previous round): a prototype without a debug
name was a function expression; with one reader it returns to that position.

## Not claimed

Tovek's SSA-level inliner, its phi-argument inlining, comparison reversal and
de-inliner are not reproduced. Our folding works on adjacent statements of one
block only.
