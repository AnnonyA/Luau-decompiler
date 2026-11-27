# Rosetta 3 results — 2026-11-27

**Complete measured results.** Quick **882/882**; Full **12,276/12,276**; Hard Quick **882/882**; Hard Full **12,276/12,276**. All four strict gates passed every usable original/profile pair. All AnnonyA rows below belong to one frozen engine, local `ff0275ea025f150d73aa29e10f3f2b7b0111907a`, published as [`08259cd6c312fe9c41eda0e0c5d0d03d9524cf71`](https://github.com/AnnonyA/Luau-decompiler/commit/08259cd6c312fe9c41eda0e0c5d0d03d9524cf71). The exact Git trees match. [Immutable mapping](engine-mapping.json)

## Accuracy on the pinned corpus

| Tier | AnnonyA | Luacid published result | lua.expert published result |
| --- | ---: | ---: | ---: |
| Quick | [882/882](annonyA-quick.json) | [879/882](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/luacid-quick.json) | [882/882](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/lua-expert-quick.json) |
| Full | [12,276/12,276](annonyA-full.json) | [12,237/12,276](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/luacid-full.json) | [12,167/12,276](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/lua-expert-full.json) |
| Hard Quick | [882/882](annonyA-hard-quick.json) | [353/882](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/luacid-hard-quick.json) | [264/882](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/lua-expert-hard-quick.json) |
| Hard Full | [12,276/12,276](annonyA-hard-full.json) | [5,622/12,276](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/luacid-hard-full.json) | [3,859/12,276](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/lua-expert-hard-full.json) |

Against these published snapshots, AnnonyA exceeds Luacid in all four tiers. It ties lua.expert on Quick at 882/882 and exceeds it on Full, Hard Quick, and Hard Full. The competitor cells link to the exact upstream report snapshots. These are accuracy comparisons against published results, not new live requests to either service. No speed ranking is claimed. [Full comparison metadata, dates, profiles, and hashes](comparison.json)

The [upstream audit](../../../docs/references/rosetta-upstream-2026-11-27.md) and its [comparison evidence](../rosetta-upstream-2026-11-27/comparison.json) verify that between the pinned `80f3c13` and `c5a0974`, the harness, corpus, four suite hashes, and all eight competitor reports are byte-identical. Only Composite result rows and related documentation changed.

The [upstream head recheck](upstream-recheck.json) records when the audited head was last confirmed unchanged.

## Complete verdict accounting

| Tier | Pass | Mismatch | Recompile failed | Decompile failed | Refused | Unusable original |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Quick | 882 | 0 | 0 | 0 | 0 | 0 |
| Full | 12,276 | 0 | 0 | 0 | 0 | 6 |
| Hard Quick | 882 | 0 | 0 | 0 | 0 | 0 |
| Hard Full | 12,276 | 0 | 0 | 0 | 0 | 6 |

**Full and Hard Full each schedule 12,282 original/profile pairs. Six profiles of the upstream original `seed1541` exhaust Rosetta's execution step budget before producing a usable reference execution, leaving 12,276 graded pairs per tier.** Those six `u` verdicts remain in the raw reports with their upstream error details. They are excluded by the pinned corpus before scoring; no candidate failure is excluded or relabeled. This is a limit of the original execution under the harness budget, not a passing decompilation. Quick and Hard Quick contain no unusable originals. [Pinned inventory and exclusions](suite-summary.json)

Quick contains 41 hand-written cases, six library specifications, 50 generated programs, and 50 mutants, each under six profiles. Full uses the same cases and libraries plus 1,000 generated programs and 1,000 mutants. Quick is a subset of Full. Hard tiers transform the same program families. Counts therefore describe profile executions and do not count independent unseen programs.

| Tier | Suite hash | Scheduled pairs | Graded pairs |
| --- | --- | ---: | ---: |
| Quick | `e24826907050bd1d` | 882 | 882 |
| Full | `f0eae8ffcedd440e` | 12,282 | 12,276 |
| Hard Quick | `9bcb49d29e867a92` | 882 | 882 |
| Hard Full | `9921d3bde4a99bfd` | 12,282 | 12,276 |

## Engine identity and measurement

| Identity | Value |
| --- | --- |
| Frozen local source | `ff0275ea025f150d73aa29e10f3f2b7b0111907a` |
| Published engine commit | `08259cd6c312fe9c41eda0e0c5d0d03d9524cf71` |
| Identical full Git tree | `ea3058b85283838ee3a765f19db2a3a7b3a0838f` |
| Engine source SHA-256 | `5f30831cc22670b8ab20822aa5a7a8d26785d8228e7408070669e6ada5dfd965` |
| Built distribution SHA-256 | `4970b410c82ae8465054ca58f748848bc6e531740d393a248ddd6e30675caff4` |
| Rosetta source | `80f3c13ce48dc3318d5d49f54958f580937ca8aa` |
| Suite / compiler / transforms | rosetta-3 / Luau 0.747 / transform-2 |

The [publication receipt](publication-receipt.json) preserves the earlier engine publication, when the complete runs were still in progress. The adjacent final reports and their provenance determine the measured scores; the receipt is not rewritten to imply those later results existed at publication time.

The adjacent `.provenance.json` files preserve the clean engine and Rosetta checkouts, Node executable and version, Rosetta binary hash, source/build hashes, exact argument array, complete process outcome, and validator summary. Local suite measurements use Node v24.22.3 and direct CLI execution, including process startup. The four suite jobs ran concurrently with other validation on this machine. Their elapsed times are retained for audit and are not compared with remote-service timings or used as a speed claim.

The runner rejects `ROSETTA_TRANSFORM_OFF`, `ROSETTA_TRANSFORM_ONLY`, and `LUAU_DECOMPILE_OPTS` overrides. Its validator reconstructs scores from every per-profile verdict; checks exact inventories, profile order, hashes, sections, details and totals; and requires the expected process outcome. A zero process exit by itself cannot establish success. Refusals remain all-pass failures. The final measurements use the strict all-pass mode. [Runner](../../../scripts/bench-rosetta.mjs) · [validator](../../../scripts/rosetta/validate.mjs) · [suite pin](../../rosetta/suite.json)

Every staged evidence file is listed in [hashes.json](hashes.json). Verify the copied bytes with:

```sh
cd benchmarks/results/rosetta-final-2026-11-27
sha256sum --check SHA256SUMS
```

## Validation beyond Rosetta

Local checks below belong to the exact measured source. Counts are read from this snapshot’s validation summary; older checkpoint totals are not reused.

| Runtime | Gate | Status | Count | Evidence |
| --- | --- | --- | --- | --- |
| v22.23.5 | build | passed | — | [log](validation/local/node22-build.log) |
| v22.23.5 | build-demo | passed | — | [log](validation/local/node22-build-demo.log) |
| v22.23.5 | typecheck | passed | — | [log](validation/local/node22-typecheck.log) |
| v22.23.5 | bench-test | passed | 69 passed, 0 failed, 0 skipped | [log](validation/local/node22-bench-test.log) |
| v22.23.5 | bench-smoke | passed | — | [log](validation/local/node22-bench-smoke.log) |
| v22.23.5 | demo-test | passed | 6 passed, 0 failed, 0 skipped | [log](validation/local/node22-demo-test.log) |
| v22.23.5 | unit | passed | 1,322 passed in 134 files | [log](validation/local/node22-unit.log) |

Not executed locally:

- **demo-browser**: Known unavailable local dependency: /usr/bin/chromium launcher exists but /usr/lib/chromium/chromium is missing. Prior frozen10 attempt returned npm1/browser127. Per root, did not repeat or install a browser; exact-head remote CI remains required.
- **Node20 local rerun**: Per root, Node20 is covered by required exact-head remote CI.
- **Official pinned Luau and public-corpus CI**: Delegated to exact-head remote CI; local reference pin differs and is not substituted.

[Commands, versions, exit codes and dependency limits](validation/local/summary.json)

Local validation did not establish a passing browser execution. Its dependency limitation or failure is preserved in the local summary and is not counted as a pass. Exact engine-head GitHub CI passed Node 20/22, the official parser/runtime checks, the real browser gate, and strict Quick/Hard Quick. [Job evidence](validation/remote-ci/ci-checkpoint-08259cd6.json)



GitHub Actions checks a synthetic `refs/pull/82/merge` commit when testing this PR. The mapping distinguishes that CI commit from the published head and the locally measured source. A synthetic merge used for testing does not merge the PR into `main`. No merge is asserted by this report.

The CI evidence applies to the identified engine publication. A later documentation-only commit triggers new checks; it must pass CI on its own latest head before merge. Earlier green runs are not carried forward as proof for that later head.

## Reproduce

Use an engine checkout at the published engine commit above, Node 20 or newer, Rust 1.100.0, and paths without whitespace. Prepare the pinned Rosetta harness:

```sh
npm ci
git clone https://github.com/Scrensayol/rosetta.git /tmp/rosetta-3
git -C /tmp/rosetta-3 checkout --detach 80f3c13ce48dc3318d5d49f54958f580937ca8aa
cargo +1.100.0 build --release --locked --manifest-path /tmp/rosetta-3/Cargo.toml
npm run bench:rosetta:test
for tier in quick full hard-quick hard-full; do
  npm run bench:rosetta -- --rosetta-dir /tmp/rosetta-3 \
    --tier "$tier" --out "$PWD/tmp/rosetta-results/$tier" --threads 2 --gallery
done
```

Each invocation rebuilds the distribution before measuring it. Quick and Hard Quick are automatic PR gates; the [Rosetta workflow](../../../.github/workflows/rosetta.yml) can run all four tiers through `workflow_dispatch`. `--measure-only` is available for retaining development failures, but it does not assert a passing gate and was not used for these measurements.

## What these results establish

This report establishes observed round-trip behavior under the fixed Rosetta suite, original executions, profile sets, and transforms. The engine was repaired using failures from this public development corpus. Those repaired cases are regression coverage, not an independent blind evaluation. Passing this finite suite does not prove correct decompilation for every Luau program, every future compiler version, or every obfuscation strategy.

[Engine changes and references](../../../docs/references/rosetta-final-2026-11-27.md) describe the fixes and their bounded evidence. [Measurement history](../rosetta-suite-2026-11-27/README.md) retains the original Quick 511/882 and Hard Quick 102/882 baseline, intermediate improvements, and regressions. The invalid auxiliary empty-Lume control remains explicitly identified alongside its corrected real-library run; it never formed part of these pinned suite measurements.
