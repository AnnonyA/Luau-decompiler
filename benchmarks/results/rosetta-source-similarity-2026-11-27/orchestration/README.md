# Final candidate validation, prepared only

No candidate is selected implicitly. No final benchmark has been launched by this preparation. The parent agent must provide the exact combined commit before `prepare` is invoked.

## Commands

From `/workspace/scratch/eb5e4be57451`, substitute the parent-approved 40-character commit and a fresh label:

```bash
python measurements/similarity-final-preparation/orchestrate.py prepare --revision FINAL_40_CHARACTER_COMMIT --label similarity-final-01 --threads 4
```

Preparation creates six detached, initially clean worktrees: one for each Rosetta tier and one for each Node validation runtime. They share no build directories. Installed dependencies are copied as hard links only after the exact package lock matches; no dependency or source edits are made. The sealed plan is written to `measurements/similarity-final-01/plan.json`.

Invoke each selected tier once, using the plan's absolute path:

```bash
python measurements/similarity-final-preparation/orchestrate.py tier --plan /workspace/scratch/eb5e4be57451/measurements/similarity-final-01/plan.json --tier quick
python measurements/similarity-final-preparation/orchestrate.py tier --plan /workspace/scratch/eb5e4be57451/measurements/similarity-final-01/plan.json --tier hard-quick
python measurements/similarity-final-preparation/orchestrate.py tier --plan /workspace/scratch/eb5e4be57451/measurements/similarity-final-01/plan.json --tier full
python measurements/similarity-final-preparation/orchestrate.py tier --plan /workspace/scratch/eb5e4be57451/measurements/similarity-final-01/plan.json --tier hard-full
```

With nine available CPU, run Quick and Hard Quick concurrently, then Full and Hard Full concurrently. Each tier has four Rosetta workers. Do not run unrelated heavy validation simultaneously, because quality diff timing and engine timing are load-sensitive.

After the tier measurements, run the two runtime validations, optionally concurrently:

```bash
python measurements/similarity-final-preparation/orchestrate.py validation --plan /workspace/scratch/eb5e4be57451/measurements/similarity-final-01/plan.json --runtime node20
python measurements/similarity-final-preparation/orchestrate.py validation --plan /workspace/scratch/eb5e4be57451/measurements/similarity-final-01/plan.json --runtime node22
```

After all six executions complete, seal the joint report once:

```bash
python measurements/similarity-final-preparation/orchestrate.py summarize --plan /workspace/scratch/eb5e4be57451/measurements/similarity-final-01/plan.json
```

The joint report compares the Git revision/tree and actual source/dist SHA-256 digests across all six snapshots. Its digest algorithm matches the existing Rosetta wrapper exactly. The expected commit tree is retained for the parent to check against the published remote tree; local checks do not claim a remote publication or CI outcome.

## Strict invariants

- All Rosetta executions use Node **v22.23.5**, its absolute executable, the unchanged repository wrapper, default engine options, strict `all-pass` mode, and `--gallery` without reduction or reruns.
- Pinned Rosetta: `80f3c13ce48dc3318d5d49f54958f580937ca8aa`; embedded Luau: `0.747`; transform: `transform-2`.
- Rosetta binary SHA-256: `5da91d395f20409b3efcc074f91ad5584a70480565e088b9d2f1bff1036c642b` at preparation preflight. The sealed plan checks it again at execution.
- Suite manifest SHA-256: `0b67b06dee91960755f9e5fbeadcd0722ec77e7d1a0b54878285b77af66ee142`.
- Quick: **882/882**, 882 total round trips, hash `e24826907050bd1d`.
- Hard Quick: **882/882**, 882 total round trips, hash `9bcb49d29e867a92`.
- Full: **12276/12276**, 12282 total round trips, hash `f0eae8ffcedd440e`.
- Hard Full: **12276/12276**, 12282 total round trips, hash `9921d3bde4a99bfd`.
- The six unusable Full/Hard Full originals must remain exactly the pinned `generated/seed1541` profiles. The existing strict validator checks identities, inventories, order, hashes, details, and every verdict. An additional independent recount checks exact expected counts and quality coverage. A process exit of zero cannot replace any of these gates.
- Source files, revision, working-tree state, and harness binary are checked before/after. Existing output directories and logs are never overwritten. Failure reports, first failure details, gallery, process exit codes, and raw output are preserved even when a gate fails.

## Failure evidence limitation

The pinned upstream gallery uses the verdict from the initial execution when `--reduce` is absent. It does not silently rerun failures. Its documented format caps entries at 150 per section, clips source/output text at 16 KiB, and clips comparison lines. The raw numeric result retains every verdict and detail; `summary.json` also records all failing profile identities. The gallery is not represented as an unlimited byte-for-byte archive. If a failure occurs, preserve this first result before any separate reproduction or engine fix.

## Runtime and demo gates

Both Node **v20.20.2** and **v22.23.5** run build, typecheck, unit tests, the benchmark harness tests, the repository smoke corpus, demo build, and demo startup tests. Unit and TAP counts are extracted; skips are not counted as passes. Smoke reports are checked for all fixtures successful and are explicitly not a claim of official syntax/runtime validation.

The real Chromium binary is currently unavailable: `/usr/bin/chromium` exists, but `/usr/lib/chromium/chromium` does not. That browser gate is recorded as **not run**, never passed. The required official Luau/public-corpus revisions in CI differ from the available local reference checkouts, so their exact-head CI gate also remains required; the local reference is not substituted.

## Prior audit archive

Evidence-only commit `cd91b4a` archives the separate 288/288 option compatibility audit at engine `850211e4d011ea8610ccee2f7262f93b8fc94191`. It is not a final-candidate Rosetta result. Its branch is `validation/integration-options`, worktree `similarity-local-scopes`, and all raw files are under `benchmarks/results/integration-options-2026-11-27/`.
