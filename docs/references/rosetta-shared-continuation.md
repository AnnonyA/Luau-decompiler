# Keep a shared iteration update outside nested alternatives

References inspected: Tovek `ce2ea3325547fa3896f274b68013386338039040`,
`restructure/src/region.rs`, `build_conditional_inner` and
`reaches_in_iteration`. Its path walker treats an enclosing stop as a possible
shared continuation when an alternative terminates. MIT license, copyright
Jujhar Singh and Mathias Pedersen. Official Luau 0.747
`c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`,
`Compiler/src/Compiler.cpp` `compileStatIf` / `compileStatWhile` and
`VM/src/lvmexecute.cpp` JUMPBACK were also inspected. The compiler patches
`continue` to the loop backedge, after any ordinary source tail. No reference
implementation code was copied or adapted.

When a nested arm returns early, a reachability-based common-join candidate
can belong to only some surviving paths. In the failing shape, a route to the
outer continuation bypasses that candidate entirely. Emitting this route up
to the candidate consumes the outer update, then emits it again after the
outer condition. A cursor consequently skips input and changes later branch
decisions.

The independent change extends the existing enclosing-boundary check: if a
forward path reaches an enclosing stop inside the active loop while avoiding
the proposed join, retain the stop. The search excludes backedges and does
not move instructions or change their values. The loop's external follow is
excluded: a break can bypass a valid internal join without consuming its tail.
Valid inner joins that all continuing paths traverse remain in place.

## Evidence

The project-authored `shared-increment-after-guard` covers ordinary, continue,
early-return and nested-state paths. A retained closure observes the cursor
and table, including table identity and a nil hole in multiple returns. The
six official O0/O1/O2, g1/g2 bytecodes and hashes are sealed under
`tests/fixtures/rosetta-shared-continuation`.

The clean current baseline is `489ce27` (full revision in the fixture manifest).
The own program and authentic Full mutant `mut1-836` both improve **0/6 to
6/6**, for **12/12** official compiler/VM round trips. The earlier first failure
from the pre-489 worktree and all original traces are retained byte-for-byte
under `benchmarks/results/rosetta-shared-continuation-2026-11-27`, alongside the
clean current baseline and candidate reports. The authentic mutant was
regenerated from pinned Rosetta's mutation pool, not from a truncated gallery.

Unit tests enumerate control-transfer paths of each sealed output AST: every
surviving iteration updates the cursor exactly once, and early-return paths
do not update it. The existing readable elseif ladder remains intact. The 55
targeted continuation, reconstruction-quality and repeat tests, plus TypeScript
checking, pass locally on Node 24. The broader 489ce27 base still has two stale
POWK expectations and one tuple-recovery assertion already being addressed in
the integration branch; they reproduce without this change. These are development
regressions, not independent holdouts or a complete Full-tier score.
