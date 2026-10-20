# Benchmark foundation (target: v0.3.0, NOT released yet)

The `bench:compare` command records **our local engine's actual bytecode results**, SHA-256 input hashes and per-file elapsed times. It does **not** execute untrusted Luau bytecode and does **not** call the LunaUX website or hosted API.

## Run the existing three real-bytecode fixtures

```sh
npm ci
npm run build
npm run bench:test
npm run bench:compare -- --output benchmarks/results/local-baseline.json
```

The three files listed in [corpus.json](corpus.json) already exist under `tests/`. Generated reports under `benchmarks/results/` should record the date, toolchain and relevant revision when published; do not assume older reports apply after subsequent changes.

## Download a baseline report from CI

Each successful Node.js 20 / 22 GitHub Actions job uploads an artifact named
`luau-baseline-node-20` or `luau-baseline-node-22` containing
`luau-baseline.json`. The job summary also shows a brief per-fixture table.
Those files measure **only this project's engine**; they are a factual
regression baseline, not a head-to-head victory claim. The source revision
and execution date can be recovered from the linked GitHub Actions run.

## Optional: benchmark LunaUX's published 22 binary samples

The corpus is pinned in [lunaux-lock.json](lunaux-lock.json) to the public competitor
commit `910ccd4d546fd0c8e21f770a30732ae246eab5c5` under **Apache-2.0**.
Its 22 raw bytecode inputs and 22 published decompiled source files have verified
**Git blob SHA-1 and byte size** entries. The benchmark verifies all 44 local files
against these entries **before running**. SHA-256 hashes are also computed from
the actual inputs in each benchmark report.

Obtain the public repository at the exact pinned commit:

```sh
git clone https://github.com/boydev-1444/lunaux-decompiler.git ../lunaux-decompiler
git -C ../lunaux-decompiler checkout 910ccd4d546fd0c8e21f770a30732ae246eab5c5
npm run bench:compare -- \
  --lunaux-dir ../lunaux-decompiler \
  --require-lunaux-count 22 \
  --output benchmarks/results/shared-fixtures.json
```

The runner uses `Tests/Binary/*.luauc` and reads corresponding
`Tests/Decompile/*.luau` **only as published reference output**. Missing,
additional or modified inputs, or modified reference output, cause an error.
This explicitly prevents silent changes to our shared benchmark corpus.

GitHub Actions on Node.js 20 and 22 fetches the same pinned public commit,
runs this benchmark and uploads `luau-shared-corpus-node-20` and
`luau-shared-corpus-node-22` as downloadable JSON artifacts.
The action runs **only our local decompiler**; it does not run or time the LunaUX
engine. Results still mark `competitorExecution: NOT_RUN` and
`semanticEquivalence: NOT_MEASURED`.

The corpus is external rather than copied into this repository. No proprietary implementation is imported and no hosted service is scraped. When doing a true head-to-head timing comparison, use a properly licensed offline LunaUX executable on the *same hardware and inputs* and independently record the command, version, timings and outputs.

## Official Luau syntax validation

To check emitted Luau with a locally built official `luau-compile` executable:

```sh
npm run bench:compare -- \
  --luau-compile /absolute/path/to/luau-compile \
  --output benchmarks/results/parser-checked.json
```

The runner invokes the compiler with `--only-parse --null <temporary-source-file>`, not the VM. When no compiler is supplied, all syntax statuses are `NOT_CHECKED`; if the executable is unavailable, status is `ERROR`, never `PASS`. A successful parse **does not** prove semantic equivalence. No source file is executed.

### CI parser baseline

A separate `syntax` GitHub Actions job builds the official Luau parser at
[luau-lang/luau@9d7748a4](https://github.com/luau-lang/luau/commit/9d7748a4f324213a18cb8283fa2a77c330225fa0)
from source with CMake. It checks the **25 inputs** (our 3 existing fixtures and the
22 locked LunaUX bytecode files) and, where published, their **22 LunaUX source
outputs**. No bytecode or emitted source is executed in the Luau VM.

The job uploads `luau-official-parser-results` (JSON) and provides an Actions
summary with per-fixture parse outcomes. The job fails if the parser is missing,
fails to execute, or if our decompiler stops emitting output for a case.
**Official syntax validity is now an enforced CI gate:** all 25 decompiled
sources must parse cleanly. If a future regression causes any Luau parse FAIL,
`bench-assert-syntax.mjs --require-all-pass` fails the job and identifies the
affected fixture. A published reference's parser result is recorded separately
and does not affect the gate for our own output.

Source parser PASS/FAIL is not a semantic equivalence result or evidence that
LunaUX's actual engine ran. Compiler revision, toolchain and source hashes should
be recorded alongside benchmark artifacts in any externally shared comparison.

### Download generated Luau for parser debugging

The official parser job also uploads a `luau-generated-source` artifact
with the decompiled text of all 25 licensed or repository-owned fixtures.
Locally, `npm run bench:compare -- --source-dir /tmp/luau-output` writes
generated sources using normalized fixture IDs. This is **opt-in**, because
generated source can contain private code when benchmarking user files.

## Controlled behavioral differential (experimental)

The project-owned `benchmarks/semantic/*.luau` files contain ten small,
deterministic programs: arithmetic, branches, while loops, closures,
tables, multiple returns, nested numeric loops, recursion, open varargs,
and short-circuit side effects. The CI builds
the pinned **official Luau interpreter** alongside `luau-compile`, compiles
each source with both `-O0 -g1` and `-O1 -g1` (20 fixture/profile pairs),
decompiles each bytecode with our engine, then runs both sources in the official
Luau interpreter. Differences in the
process result, standard output, and standard error are recorded as
`MISMATCH` or `ERROR` with the reconstructed source saved in the JSON.
The first run of the eight-case controlled corpus with the pinned official
Luau VM confirmed **8/8 matching traces**, including table mutation,
multiple-return forwarding, nested numeric loops, and recursion.
The pinned official Luau VM confirmed **16/16 matching traces** in the first
O0/O1 matrix run (8 fixtures × 2 compiler optimization profiles), with zero
mismatches or execution errors. **Those sixteen previously confirmed profile-specific checks remain
mandatory CI gates.** Every program is compiled, reconstructed, executed and
compared for both `-O0 -g1` and `-O1 -g1` on each CI validation run.

On 2026-10-20, the pinned official VM confirmed both O0 and O1 `varargs`
traces after fixing open `RETURN` packs: **18/20** checks now match.
The nine verified programs (18 compiler-profile pairs) are blocking CI gates.
The two `shortcircuit` profile pairs remain **MISMATCH**: the recovered code
reuses a single local for four separately observed values. They remain visible
in each report but are not falsely marked as passing.
These selected cases are not a general semantic equivalence proof or a
measurement of the LunaUX executable.

```sh
npm run build
npm run bench:semantic -- \
  --luau-compile /absolute/path/to/luau-compile \
  --luau /absolute/path/to/luau \
  --output benchmarks/results/controlled-semantics.json
```

The runner **executes Luau code**, unlike the syntax-only benchmark. It uses
a hard-coded allowlist of original fixtures authored in this repository.
**Do not supply third-party or user-uploaded files to this runner.** Its
process timeouts and output limits are not a full operating-system sandbox.

The first comparison on bytecode v14 measured **1/4 matching traces**.
After fixing open CALL argument handling in PR #48, the official VM confirmed
**3/4 matching traces**. PR #49 corrected while-loop classification for headers
with comparison setup instructions; the official VM now confirms **4/4 matching
traces**: `arithmetic`, `branches`, `loop`, and `closure`. All four fixtures
are **blocking CI gates**, and their input bytecode, reconstructed outputs and
observed traces remain available in each CI JSON artifact.

These are reproducible checks on selected programs, not proof of general
semantic equivalence.

Matching stdout/stderr/exit status on selected examples proves only the observed
trace for those particular inputs; it does not prove general semantic
equivalence, closure identity, heap state or parity with LunaUX. The JSON
artifact from CI includes the original-bytecode hashes and both execution
traces. Additional independent held-out programs and stronger assertions
will be needed before v0.3.0 is ready.

## Interpreting the report

- `sha256`, `inputBytes`, `bytecodeVersion`, `supportStatus` and `errorCode` identify exactly what our engine decoded and whether it succeeded.
- `durationMs` is only our decompile call (not external fetching, process startup, or compiler parsing). Timings can vary and are **not** comparable with remote API latency.
- `processRssBytesAtEnd` is a process-level final snapshot, **not** a peak measurement or isolated per-file memory usage.
- `sourceMetrics.registerPlaceholders` is a basic textual proxy, not a precision/recall measure and may include matches in strings or comments.
- `semanticEquivalence` is `NOT_MEASURED` until controlled differential execution is implemented using licensed input examples and an independent correctness oracle.
- `competitorPublishedSource` is an artifact from LunaUX's repository, not a measured competitor engine invocation.

## Next work for v0.3.0

The 22 public fixtures and published outputs are now pinned by Git object hashes and run in CI. Next: add a sufficiently diverse independently licensed corpus and official Luau parsing checks; build controlled source→bytecode→decompile→parse and semantic differential checks, with a holdout separate from optimization. Independently measure **both engines** on the same hardware before reporting any superiority.
