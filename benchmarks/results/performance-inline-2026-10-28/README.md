# Numeric O2 helper recovery and performance — 2026-10-28

Baseline: `4f059cf0b9381bf534a600c88a2e8338608fbde9`. Engine build hashes, host,
compiler hash/revision, exact source/bytecode hashes and raw samples are in
[report.json](report.json); per-profile medians are in [profiles.md](profiles.md).

On these 30 large profiles, summed per-profile median time fell from
**8910.8 ms to 7490.5 ms (15.9% less)** with recovery disabled for
an output-identical comparison. All **30/30** source/AST/disassembly/diagnostic/
validation hashes match. The new default, including numeric helper recovery,
took **7744.6 ms (13.1% less than baseline)**.

Peak whole-worker RSS was **222.8 / 216.9 / 218.8 MiB**
for baseline / optimized without recovery / new default. Median per-profile RSS
change without recovery was +0.4%. This is a time improvement, not evidence
of reduced peak memory. Five measured samples follow one warmup in fresh,
sequential processes; GC is outside timing. Earlier exploratory measurements,
including one briefly overlapped by a review stress probe, are excluded.

The engine now restores calls to retained single-return numeric helpers expanded
by O2. See [examples](examples) and [proof boundaries](../../../docs/references/inline-recovery-performance.md).
The official line-delta decoder was corrected (uint8 wraparound and cumulative
base deltas). Allocation hot spots were removed from name suffix selection,
module-global reservation, scope lookup, liveness arrays and SSA version counting.
General recovery of arbitrary eliminated functions remains unsupported.

Validation on this build:

- 450 unit tests and 46 benchmark-harness tests passed.
- 705/705 O0/O1/O2 and naming-style regression profiles passed, covering 870 input runs and official syntax checks.
- Historical 200/200, 24/24 and 36/36 suites passed.
- Both large cohorts passed 30/30 profiles; 9/9 subsequent independent cases are now tracked as development regressions.
- Seeded fuzzing passed 90/90 profiles; Chromium worker/interface and demo tests passed.

[validation.json](validation.json) records per-profile identities, hashes and
statuses. [inline-regression-traces.json](inline-regression-traces.json) retains
the full original/reconstructed traces for the four new fixtures. The new repeat/
continue fixture originally printed nothing on its skip input, which the harness
correctly classified NO MEDIDO; a final completion print was added before sealing
this new test. No existing sealed source, bytecode or competitor output changed,
and the nonempty-trace requirement remains intact.

These are observed development corpora, not a new blind comparison. No external
API requests were made and no competitor superiority or universal accuracy is
claimed. Reproduce with the commands in the proof-boundaries document; required
Node 20/22, official Luau parser/runtime and demo checks are also enforced in CI.
