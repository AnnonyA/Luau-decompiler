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

## Optional: benchmark LunaUX's published 22 binary samples

If redistribution/provenance is acceptable for your use, obtain a local checkout of [boydev-1444/lunaux-decompiler](https://github.com/boydev-1444/lunaux-decompiler) yourself, record its exact commit SHA and license, then run:

```sh
npm run bench:compare -- \
  --lunaux-dir ../lunaux-decompiler \
  --require-lunaux-count 22 \
  --output benchmarks/results/shared-fixtures.json
```

This scans `Tests/Binary/*.luauc` and optionally reads corresponding `Tests/Decompile/*.luau` **as pre-existing published output**. It runs **only our** local decompiler on the binary files. A published source artifact is not a semantic oracle, and its availability is not evidence that the LunaUX executable was run or timed. Results explicitly mark `competitorExecution: NOT_RUN` and `semanticEquivalence: NOT_MEASURED`.

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
- `processPeakRssBytes` is a process-level snapshot, **not** isolated per-file peak memory.
- `sourceMetrics.registerPlaceholders` is a basic textual proxy, not a precision/recall measure and may include matches in strings or comments.
- `semanticEquivalence` is `NOT_MEASURED` until controlled differential execution is implemented using licensed input examples and an independent correctness oracle.
- `competitorPublishedSource` is an artifact from LunaUX's repository, not a measured competitor engine invocation.

## Next work for v0.3.0

Pin and hash the 22 public benchmark files at an explicit competitor commit; add a sufficiently diverse licensed independent corpus; build controlled source→bytecode→decompile→parse and semantic differential checks, with a holdout separate from optimization; and publish per-sample **both-engine** measurements before reporting any superiority.
