# Independent reductions

These project-authored sources exercise constructor register reuse, shared alternatives, effectful loop latches, mutable upvalue snapshots, consumed calls, loop-exit lexical bindings, and deferred arithmetic depending on mutable SSA values. The last two were found independently during review, without inspecting reserved-corpus implementations.

Bytecode was generated with official Luau revision `9d7748a4f324213a18cb8283fa2a77c330225fa0`, `--binary -g1`. Optimization is O1 for `loop-call-lifetime`, `loop-exit-binding`, and `phi-expression-snapshot`; O0 for the other committed fixtures. The unit suite reads these exact blobs. `npm run bench:large:regressions` separately recompiles every source at O0/O1/O2 and compares original/reconstruction stdout, stderr and exit success with the official VM. Each source includes its own deterministic calls and assertions; repeated CLI arguments are not counted as additional coverage.

PR59 follow-up fixtures `conditional-table-fields`, `mixed-table-packs` and `call-before-target-read` use O0/-g1 committed bytecode. They independently reduce failed boolean speculation, conditional constructor phi assignment, mixed keyed/list open return packs, and assignment-target evaluation order.

`closed-capture-reuse` (O0/-g1) was found by independent review: CLOSEUPVALS ends cell ownership before a later constructor phi reuses the physical register. The fixture checks both branches.
