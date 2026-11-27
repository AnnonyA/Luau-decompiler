# Preserve evaluation order while snapshotting list fields

References inspected: Tovek `ce2ea3325547fa3896f274b68013386338039040`,
`ast/src/rebuild_table_literals.rs`, particularly its captured-local and
dependency restrictions for constructor recovery. MIT license, copyright
Jujhar Singh and Mathias Pedersen. Official Luau 0.747
`c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`,
`Compiler/src/Compiler.cpp` `compileExprTable` and `VM/src/lvmexecute.cpp`
SETLIST were also inspected. The compiler evaluates list elements in order
into register batches; SETLIST copies those values, with its open final tail
bounded by the VM stack top. No reference implementation was copied or adapted.

The constructor snapshot change exposed a regression in `{cell, advance(), cell}`.
The last cell read was emitted into a temporary before the deferred middle call
was evaluated. Consequently both cell snapshots observed the value before the
call, despite the original instruction stream reading the last value afterward.

The independent fix finds the last scalar field requiring a snapshot in each
SETLIST batch, then snapshots the complete scalar prefix in element order. Any
deferred call preceding that read therefore executes first. The trailing open
result pack stays in list context, preserving multiple results and nil holes.
The behavior of constructors without such snapshots is unchanged.

## Reproduction and validation

The project-authored `constructor-captured-read-order` covers two mutations in
one list, reads on both sides, a named field followed by an open list tail,
retained closures, table identity and return arity. Its six original bytecodes
and hashes are sealed under `tests/fixtures/constructor-read-order`.

It improves **2/6 to 6/6**; Rosetta `captured_args` also improves **2/6 to 6/6**.
All **30/30** directed round trips pass, including the three existing mutable
and open-constructor regressions. `register_pressure` and `lume` additionally
pass **12/12**, checking that the new scalar prefix does not exceed the local
register limit in those controls.

The first auxiliary report used a nonexistent `libraries/lume.luau` path.
Pinned Rosetta `check` silently compiled an empty source for that missing path,
so its six apparent Lume passes were invalid. That report remains preserved as
`register-controls-invalid-empty-lume.json`. The corrected `register-controls.json`
uses the real `libraries/lume` directory and its specification: all **12/12**
genuine controls pass. Source hashes and the exact correction command are recorded
in `register-controls-correction.json`. The original 30 constructor cases and
pinned Quick/Full benchmark measurements were unaffected.

The bisection retained with the evidence proves c5cb88e,489ce27,f0c9d53 and
adc6482 pass both affected Quick families. The independent iterator regression
starts in e943d25; the captured-argument regression starts in a704137. This
change addresses only the latter. The first own and authentic failures remain
unchanged under `benchmarks/results/constructor-read-order-2026-11-27`.

The unit oracle observes the sealed O0/O1 scalar prefix with a mocked advancing
closure and requires the first list to be `{10,12,12}`. O2 is retained as an
official compiler/VM control. These cases are development regressions, not an
independent holdout or a complete tier score.

Local validation passes **147/147** focused unit tests and TypeScript checking
on Node 24. The integration branch still requires a fresh complete Quick run.
