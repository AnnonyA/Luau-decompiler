# Sealed synthetic game systems

Two independently authored programs are retained as reusable runtime tests:
`physics-bezier-arena.luau` (349 physical lines) and
`service-controller-raid.luau` (360 physical lines). They use ordinary Luau
libraries and deterministic inputs, without Roblox APIs or an external framework.
The first combines Bézier curves, steering, fixed-step physics, collision,
signals and rollback. The second combines service dependency/lifecycle handling,
coroutine scheduling, inventory transactions, combat and quests. Both exercise
function keys, private mutable counters, evaluation order and multiple returns.

There are **12 bytecodes**, covering v9/v14 and O0/O1/O2 for both programs, and
**24 execution profiles**. Each profile loads the chunk once and activates that
same entry closure four times with a sealed input sequence. The host checks
marker identity, table-key behavior, counter independence and returned checksums.
Floating point checksums print at 17 significant digits. Source assertions and
expected stdout are retained without changes; saved bytecode is the oracle.

```sh
npm ci
npm run build
npm run bench:game-systems -- \
  --luau-source /absolute/path/to/pinned-luau \
  --luau-build /absolute/path/to/pinned-luau/build/release \
  --output /absolute/path/to/new-game-system-results
```

Use official Luau `9d7748a4f324213a18cb8283fa2a77c330225fa0`. The runner builds
`scripts/closure-identity/run_game_systems.cpp`, verifies every bytecode hash,
compiles unedited recovered source through the version-appropriate entry point,
and compares exact original/reconstructed traces. The output path must be new.
The benchmark makes no API requests and exits nonzero for any mismatch or error.
CI runs this separately from the closure identity matrix.

`ORIGINAL-SEAL.json` is the unchanged pre-evaluation seal of the original external
evidence layout. `IMPORT.json` records the mapping/provenance of its imported
inputs and the exact host hash. Sources were authored before consulting a
candidate's output; the author knew the task's previously discussed failure
categories, so this is not a claim of double-blind authoring.

`first-observation.json` preserves all 48 first actual observations: 24 against
integration base `291c3076` and 24 against frozen candidate `e26040ae`. Both engines
matched 22/24; both physics v9/O2 input sequences diverged. These observations
remain historical even after fixes. An earlier wrapper startup error occurred
before importing either engine; `INITIAL-HARNESS-FAILURE.md` explains it and the
complete failed wrapper attempt is retained in the accompanying evidence. It is
not counted as an engine result.

The original initial oracle used a lower-precision host checksum display. Before
any decompiler evaluation, a separate oracle-02-exact used the current 17-digit
host and reverified all 24 originals. Both phases remain in the evidence; only
the latter supplies this gate. These programs are now development regressions,
not fresh independent tests on later candidates.
