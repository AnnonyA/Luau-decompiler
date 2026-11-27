# Register uses follow executable edges

References inspected: Tovek `ce2ea3325547fa3896f274b68013386338039040`
(MIT), `cfg/src/ssa/destruct/liveness.rs` and `destruct.rs::build_def_use`;
official Luau 0.747 `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`,
`VM/src/lvmexecute.cpp` CALL and MOVE. This TypeScript implementation is
independent; no reference source was copied.

Counting physical instructions after a definition is unsound when blocks are
permuted. A value can have many later executable consumers at lower program
counters. The old scan classified an object-producing call as unused, emitted
a discard evaluation, and then substituted the same call expression at each
consumer. That changes both object identity and observable effects.

`definitionUseInfo` now walks actual CFG successors until the register is
overwritten on each path. Reads precede writes at the same instruction; each
reader is counted once; cycles terminate through a visited set. The immutable
query is cached for repeated speculative walks. Both use counts and use outside
the defining block share that result. Known open calls use their decoded prefix
and tail, while an unknown dynamic top retains the conservative register range.

The authored fixture creates one object, aliases and mutates it, returns four
values and captures the object in a closure. Its consumers are placed before
the call producer in physical bytecode order, with valid connecting jumps and
debug metadata. The official VM agrees with the original in all six profiles.
Before repair, all six decompilations create seven objects and fail both identity
checks; afterward they create one object and preserve mutation, captures and
return arity in all six.

Sources, original and permuted bytecodes and hashes are retained under
`tests/fixtures/permuted-call-identity`. The initial probe with incomplete g1
debug metadata is explicitly identified separately from the six valid failing
round trips. Results are under
`benchmarks/results/permuted-call-identity-2026-11-27`. Hard seed1633 and two
authored iterator controls pass 18/18; all 51 source programs that failed the c5
Full measurement pass 306/306 on this development check. Those sources are now
development regressions, not an independent all-suite result.
