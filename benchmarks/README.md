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

## Interpreting the report

- `sha256`, `inputBytes`, `bytecodeVersion`, `supportStatus` and `errorCode` identify exactly what our engine decoded and whether it succeeded.
- `durationMs` is only our decompile call (not external fetching, process startup, or compiler parsing). Timings can vary and are **not** comparable with remote API latency.
- `processRssBytesAtEnd` is a process-level final snapshot, **not** a peak measurement or isolated per-file memory usage.
- `sourceMetrics.registerPlaceholders` is a basic textual proxy, not a precision/recall measure and may include matches in strings or comments.
- `semanticEquivalence` is `NOT_MEASURED` until controlled differential execution is implemented using licensed input examples and an independent correctness oracle.
- `competitorPublishedSource` is an artifact from LunaUX's repository, not a measured competitor engine invocation.

## Next work for v0.3.0

The 22 public fixtures and published outputs are now pinned by Git object hashes and run in CI. Next: add a sufficiently diverse independently licensed corpus and official Luau parsing checks; build controlled source→bytecode→decompile→parse and semantic differential checks, with a holdout separate from optimization. Independently measure **both engines** on the same hardware before reporting any superiority.
