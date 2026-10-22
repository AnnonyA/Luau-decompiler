# Integration evidence for PR58

Engine corrections: `45e4157` on `benchmark/three-engine-originals`.
[PR #58](https://github.com/AnnonyA/Luau-decompiler/pull/58) is the integration
record; its Checks tab records the final tested commit and its timeline records
readiness and the squash merge SHA. No merge is authorized while a gate fails.

Local verification of the corrected engine:

| Check | Result |
|---|---|
| Unit tests | 355 PASS |
| Benchmark harness tests | 34 PASS |
| TypeScript check/build | PASS |
| Official syntax corpus | 25/25 PASS |
| Existing controlled semantics | 200/200 MATCH |
| Competition originals, three inputs each | 24/24 MATCH |
| Extra regression profiles, three inputs each | 36/36 MATCH |
| Demo workers / Chromium subpath | 3 + 1 PASS |
| Cached competitor replay | 48/48 MATCH, zero requests |
| Reference integrity | 96/96 byte-identical files |

The CI workflow independently runs tests/typecheck/build on Node 20 and 22,
then builds the pinned official compiler/runtime and gates syntax, the old 200
comparisons, the 24 originals, and the 36 extra profiles. The Browser demo
workflow runs worker tests and the real browser check. PR deployment is skipped;
GitHub Pages deployment follows the main push after a successful merge.

Historical failure evidence is intentionally retained in `actions.json`:
[CI run 39710271449](https://github.com/AnnonyA/Luau-decompiler/actions/runs/39710271449)
failed the new-original gate at 15/24 before this continuation. It does not
represent the corrected engine. The prior
[Browser demo run 39710271441](https://github.com/AnnonyA/Luau-decompiler/actions/runs/39710271441)
passed. Current run links and conclusions are recorded in the PR description.

`final-evidence.tar.gz` holds the local final reports and full comparison files.
Historical before/after API evidence remains unchanged in `evidence.tar.gz`.
