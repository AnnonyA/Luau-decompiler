# Readable-structure regressions

Project-authored programs behind the structural rewrites: guard clauses,
merged conditions, rebuilt `elseif` ladders, short-circuit values, folded
temporaries and closures written in place. Each prints observations that the
decompiled source must reproduce under the official VM at O0 and O1
(`npm run bench:regressions`). They take no input; the runner's arguments are
ignored.

| File | Exercises |
| --- | --- |
| `control-flow.luau` | `if`/`elseif` ladders, `while`/`repeat`/numeric and generic `for`, `break`, `continue`, `and`/`or` values |
| `guard-structure.luau` | early exits, shared terminal arms, nested conditions inside loops, values assigned across a test |
| `objects-closures.luau` | metatables, method calls, captured counters, memoized recursion, varargs, `pcall`, nested table stores |