# Reproducible Rosetta measurements

The integration pins [Rosetta](https://github.com/Scrensayol/rosetta) to
`80f3c13ce48dc3318d5d49f54958f580937ca8aa`: **rosetta-3**, **Luau 0.747**,
and **transform-2**. The machine-readable pin and complete program inventories are
in [`benchmarks/rosetta/suite.json`](../../benchmarks/rosetta/suite.json).
The inventories were extracted from the four published result files identified
by path and SHA-256 in that manifest.

| Tier | Programs | Round trips executed | Usable round trips | Suite hash |
| --- | ---: | ---: | ---: | --- |
| quick | 147 | 882 | 882 | `e24826907050bd1d` |
| full | 2,047 | 12,282 | 12,276 | `f0eae8ffcedd440e` |
| hard-quick | 147 | 882 | 882 | `9bcb49d29e867a92` |
| hard-full | 2,047 | 12,282 | 12,276 | `9921d3bde4a99bfd` |

Each program runs at six profiles. Full adds 1,000 generated programs and 1,000
mutants to 41 hand-written cases and six libraries. Quick selects 50 generated
programs and 50 mutants from that same corpus. The only unusable original is
`generated/seed1541`, at all six Full profiles: the original itself exhausts
Rosetta's execution budget. The validator rejects any different exclusion.

Rosetta-2's 12,240-case results belong to an older suite. Rosetta-3 adds 36
library round trips, and the hard transform changed to fix a `CLOSEUPVALS`
register-permutation bug. Compare only results with the same suite hash.

## Prepare and run

Use Node.js 20 or newer and the Rust 1.100.0 toolchain used in CI. Install the
decompiler's dependencies with `npm ci`, then prepare an unmodified Rosetta
checkout:

```sh
git clone https://github.com/Scrensayol/rosetta.git /tmp/rosetta
git -C /tmp/rosetta checkout --detach 80f3c13ce48dc3318d5d49f54958f580937ca8aa
cargo build --release --locked --manifest-path /tmp/rosetta/Cargo.toml

npm run bench:rosetta -- \
  --rosetta-dir /tmp/rosetta \
  --tier quick \
  --out tmp/rosetta/quick-run \
  --threads 4 --gallery
```

Use `--tier full`, `--tier hard-quick`, `--tier hard-full`, or `--tier all` for
the other measurements. `--tier all` collects each tier even if an earlier
tier has measured failures, and exits nonzero if any requested gate fails.
Choose a fresh output directory for each run: existing evidence is never
overwritten. Without `--out`, a new timestamped directory under `tmp/rosetta/`
is used.

The runner rebuilds `dist` with the installed TypeScript compiler using the
same Node executable that performs each decompilation. Rosetta invokes
`node dist/cli.js decompile {}` directly for every bytecode input. Measured
child CPU includes Node startup and decompilation. An HTTP client/server split
would measure the client separately and is intentionally not used here.

Unset `ROSETTA_TRANSFORM_OFF`, `ROSETTA_TRANSFORM_ONLY`, and
`LUAU_DECOMPILE_OPTS` before running. Even empty explicit overrides are rejected.
Rosetta's transform overrides are not included in its suite hash, so accepting
them could produce incomparable results carrying the same hash. The Rosetta
checkout must have the exact pinned HEAD, unchanged tracked files, and no extra
files under `cases/` or `libraries/`.

Rosetta splits the decompiler command on whitespace without shell quoting.
The runner rejects whitespace or `{}` in the Node executable and engine CLI
paths; put the checkouts in paths without those characters. Arguments sent to
Rosetta itself are passed as an array, without a shell.

## Validation and failure handling

Rosetta's `bench` command exits zero even when decompilation fails. This runner
reconstructs results from every test's per-profile verdict letters instead of
trusting that exit status. It checks the pinned suite hash, version, profiles,
complete section/program inventories, unusable originals, failure details,
section scores, overall score, and verdict totals.

The default gate requires **every usable round trip to pass**. A refusal, crash,
timeout, compilation failure, or behavior mismatch fails the gate. For
development measurement while failures remain, explicitly opt into:

```sh
npm run bench:rosetta -- --rosetta-dir /tmp/rosetta \
  --tier hard-full --out tmp/rosetta/hard-development --gallery --measure-only
```

`--measure-only` permits valid measurements containing failures to exit zero.
It never changes their verdicts, ignores a malformed/incomplete result, lowers
the denominator, or bypasses a failed Rosetta process. The provenance labels
the run `measurement-only` and records `allPass: false` when cases fail.

To validate an existing result independently:

```sh
npm run bench:rosetta:validate -- tmp/rosetta/quick-run/annonyA-quick.json
```

The same `--measure-only` option permits inspecting a structurally valid result
that contains failures. `--tier` and `--expected-version` can additionally bind
validation to a requested tier and engine revision.

## Evidence and CI

Each tier retains the original `annonyA-<tier>.json` and a
`annonyA-<tier>.provenance.json` sidecar. With `--gallery`, Rosetta also writes
the failure gallery. The gallery is capped at 150 failures per section and
excludes refusals; the primary result contains all verdicts.

Provenance includes the engine commit and Git tree, dirty state, actual source
and `dist` digests, Node version and executable hash, Rosetta source revision
and executable hash, commands, timing mode, threads, exit status, timestamps,
result hash, validation summary, and any failure. A dirty engine is labeled
`<commit>+dirty`. Source, compiled output, and Rosetta checks are repeated after
measurement to detect a build changing during a run. A sidecar documents a
local measurement; it does not make a result officially verified by Rosetta.

The separate **Rosetta** workflow runs a strict Quick gate for pull requests
and pushes to `main`. Manual `workflow_dispatch` can run any tier or all four,
with an explicit measurement-only switch that defaults to false. Complete
evidence is uploaded even when the benchmark step fails. The existing Node
20/22, official parser/runtime, and demo checks remain in force. Validator and
runner regression tests also run in the existing `npm run bench:test` suite.

Passing a finite benchmark establishes these observed round trips. It does not
prove semantic equivalence for arbitrary Luau programs or superiority on every
readability, speed, or workload criterion.
