# Captured-state recovery and cell lifetime — 2026-10-29

Compared with main `8ac551578a4400e30587e9b52a721bd184b88904`, recovery now
matches ordered numeric upvalue writes, compound updates, zero-argument helpers,
and mixed captured-cell/private-table effects. It supports once-initialized forward
local functions and ignores only proven unused primitive caller snapshots.

Three correctness fixes accompany the extension:

1. Loop phi installation preserves the same open REF cell across intermediate
   writes, even when only the last write feeds the SSA phi. Previously the counter
   restarted from zero and closures captured an iteration-local replacement.
2. A branch join preserves that marker only when both arms still own the same open
   cell. It cannot resurrect a cell closed with CLOSEUPVALS. The synthetic test
   previously changed a reader's 1/2 result into 4/5.
3. Copies of captured values are snapshotted before branch mutation, in a scope
   that survives the join. This also fixes the newly observed public Tovek
   `cell_swap_beside_copy` trace without changing its source or bytecode.

Five new originals include O0/O1/O2 bytecode, three input sets, and five naming
styles: **75 profiles / 225 input executions**. [examples](examples) contain
before/after source, disassembly, raw/final AST and CFG/SSA; [examples.json](examples.json)
records hashes. [counter-first-failure.json](counter-first-failure.json) preserves
the observed failure before the cell fix. [new-fixture-traces.json](new-fixture-traces.json)
records the final observations. These are development regressions, not blind tests.

Final local validation: **486 unit tests**, **50 benchmark tests**, **885/885**
style/optimization profiles over **1,410** input executions, historical **200/200**,
**24/24**, **36/36**, large cohorts **30/30**, observed independent regressions
**9/9**, and seeded fuzzing **90/90**. Official parsing and execution are included.
Report hashes are in [validation.json](validation.json). The six demo tests pass;
the Chromium download test exposed a file-creation/write race and now waits for
the complete expected content while retaining the exact-content assertion.

The newly added [Tovek public evaluation](../tovek-public-2026-10-29/README.md)
contains remaining failures. Therefore this branch is not claimed ready to merge
or universally accurate. No external decompiler API requests were made, no sealed
input was changed, and no competitor engine was executed.

See the [reference study and proof boundaries](../../../docs/references/tovek-captured-state-recovery.md)
and [public-corpus reproduction instructions](../../TOVEK.md).
