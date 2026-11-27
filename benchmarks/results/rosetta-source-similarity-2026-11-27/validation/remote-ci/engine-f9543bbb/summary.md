# Exact-head CI evidence

Published head: `f9543bbb26615f50aa599cead318beb0f9a6e7a0`. Local source: `326d85ed21c0a7bef6dcd07a26e38b49f0148a84`.

All six required jobs pass. The executed synthetic test merge is `0568e8fcb12f48392e1a93ff9b9aa3a90da31189`; its tree `596bd4510ff32ebb978dbfaf15d9814dbcc1b198` is identical to the published head. This is evidence of CI execution, not a merge to main.

| Gate | Verified result |
| --- | --- |
| [Test, typecheck and build (Node 20)](https://github.com/AnnonyA/Luau-decompiler/actions/runs/46073238022/job/140754888272) | 1540/1540 units in 145 files; 69/69 harness, zero skipped |
| [Test, typecheck and build (Node 22)](https://github.com/AnnonyA/Luau-decompiler/actions/runs/46073238022/job/140754888597) | 1540/1540 units in 145 files; 69/69 harness, zero skipped |
| [Browser demo](https://github.com/AnnonyA/Luau-decompiler/actions/runs/46073237988/job/140754887612) | Demo 6/6; actual Chromium 1/1; zero skipped |
| [Official parser/runtime](https://github.com/AnnonyA/Luau-decompiler/actions/runs/46073238022/job/140755487010) | Job and required steps successful |
| [quick](https://github.com/AnnonyA/Luau-decompiler/actions/runs/46073237986/job/140754887902) | Strict 882/882; zero mismatches, failures, refusals or unusable profiles |
| [hard-quick](https://github.com/AnnonyA/Luau-decompiler/actions/runs/46073237986/job/140754888277) | Strict 882/882; zero mismatches, failures, refusals or unusable profiles |

The Pages deploy job is skipped for this pull-request run. This does not claim a Pages deployment.

This evidence applies to the head above. A later documentation commit must receive its own fresh CI verification before merge; results here must not be relabeled as checks of a later head.
