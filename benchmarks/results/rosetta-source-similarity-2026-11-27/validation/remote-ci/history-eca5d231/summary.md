# Exact-head CI evidence

Published head: `eca5d23168f56c2c96dce10817ffe2165e55959c`. Local source: `850211e4d011ea8610ccee2f7262f93b8fc94191`.

All six required jobs pass. The executed synthetic test merge is `9bd343caa0ee04c2714b77c2d5af631bdda29ef7`; its tree `efa414186131b91d32598e5ae68c878acb7783aa` is identical to the published head. This is evidence of CI execution, not a merge to main.

| Gate | Verified result |
| --- | --- |
| [Test, typecheck and build (Node 20)](https://github.com/AnnonyA/Luau-decompiler/actions/runs/46071795187/job/140751126219) | 1483/1483 units in 142 files; 69/69 harness, zero skipped |
| [Test, typecheck and build (Node 22)](https://github.com/AnnonyA/Luau-decompiler/actions/runs/46071795187/job/140751124326) | 1483/1483 units in 142 files; 69/69 harness, zero skipped |
| [Browser demo](https://github.com/AnnonyA/Luau-decompiler/actions/runs/46071795169/job/140750236004) | Demo 6/6; actual Chromium 1/1; zero skipped |
| [Official parser/runtime](https://github.com/AnnonyA/Luau-decompiler/actions/runs/46071795187/job/140751725716) | Job and required steps successful |
| [quick](https://github.com/AnnonyA/Luau-decompiler/actions/runs/46071795195/job/140750235723) | Strict 882/882; zero mismatches, failures, refusals or unusable profiles |
| [hard-quick](https://github.com/AnnonyA/Luau-decompiler/actions/runs/46071795195/job/140750236046) | Strict 882/882; zero mismatches, failures, refusals or unusable profiles |

The Pages deploy job is skipped for this pull-request run. This does not claim a Pages deployment.

This evidence applies to the head above. A later documentation commit must receive its own fresh CI verification before merge; results here must not be relabeled as checks of a later head.

## Preserved historical failure and retry

The first Node 22 job failed while fetching the pinned LunaUX corpus: Git returned HTTP 403 and exit 128. Node 20 fetched the same pin successfully. Only failed jobs were retried, without engine or workflow changes; the second Node 22 job succeeded. Both the first-failure log hash and successful log are retained. These counts belong to this historical checkpoint, not the later engine.
