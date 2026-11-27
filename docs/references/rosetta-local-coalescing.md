# Lexical scopes when coalescing accumulator storage

References inspected for this independently implemented change:

- Tovek `ce2ea3325547fa3896f274b68013386338039040`, MIT,
  `ast/src/coalesce_locals.rs`: storage groups retain loop and branch scopes;
  a textual last occurrence alone cannot prove that loop storage is dead.
- Official Luau 0.747 `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`,
  `Compiler/src/Compiler.cpp`, `compileStatLocal`, `compileStatWhile` and
  `compileStatRepeat`: body locals and the live loop-control binding retain
  different lexical lifetimes. The header or until expression reads the
  control value again after the body's final textual use.

`NameInference` previously allowed an outer generated zero/empty local to
absorb declarations in a nested body. Its forward textual-use scan missed a
while header's next iteration and a repeat condition after descending into the
body. A temporary zero reset the counter, or an unused closure replaced it with
a function. Restricting coalescing to the same declaration scope retains the
existing sequential coalescing and capture protections while excluding those
cross-scope writes. No reference implementation was copied.

The project-authored `closure-in-repeat.luau` failed O0g1 before this repair
(5/6 profiles passed), and passes all six official O0/O1/O2 and g1/g2 profiles
afterward. `empty-in-while.luau` is a passing control (6/6 before and after).
Both sources, bytecode hashes, the first paired report and original failing
output are retained under `tests/fixtures/rosetta-cleanup` and
`benchmarks/results/rosetta-local-coalescing-2026-11-27`.

AST-level regressions separately exercise while and repeat headers, and assert
that the counter has only its intended arithmetic write and that the temporary
keeps its body-local declaration. Runtime development checks of the complete
Rosetta sources seed1042, seed1178 and seed1338 pass all six profiles after the
repair. These are development regressions, not a new independent holdout.
