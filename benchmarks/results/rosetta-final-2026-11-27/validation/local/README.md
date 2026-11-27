# Frozen candidate 11 validation

Revision: `ff0275ea025f150d73aa29e10f3f2b7b0111907a`.
Tree: `ea3058b85283838ee3a765f19db2a3a7b3a0838f`.
Runtime: `v22.23.5`.

The validation worktree was clean before and after the run. Source files, fixtures and assertions were not changed. Both builds finished before the test phase. Unit tests used two workers to share resources with the separate frozen Rosetta runs.

| Executed gate | Result |
|---|---|
| Full unit suite | 1,322/1,322 tests across 134 files |
| TypeScript typecheck | Pass |
| Build | Pass |
| Demo build | Pass |
| Benchmark harness tests | 69/69; no skips |
| Local benchmark smoke | Pass |
| Demo and worker tests | 6/6; no skips |

All executed commands exited 0.

## Gates not executed locally

Chromium was not launched again: the prior frozen10 attempt established that `/usr/bin/chromium` points to the missing `/usr/lib/chromium/chromium` (browser exit127). No browser installation or test changes were made. This is recorded as not run because the dependency is unavailable, not as a pass.

Per root, Node20 and the exact official Luau/public-corpus gates are covered by required remote CI on the published final revision. Node20 was not rerun locally. Remote browser CI also remains required.

## Evidence

- `summary.json`: revision, tree, runtime, commands, exit codes, durations, actual counts and gates not run.
- `node22-*.log`: complete output from each executed gate.
- `node22-baseline.json`: local smoke benchmark.
- `run.py`: exact local orchestration.
