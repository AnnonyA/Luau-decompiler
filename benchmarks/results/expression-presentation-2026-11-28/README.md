# Expression presentation development evidence — 2026-11-28

See `docs/references/expression-presentation.md` for invariants, limits,
references and reproduction commands. Baseline: `fc6e10a`, unchanged engine
from `232332339cf07211e791a6a67bd395a2031b20a5`.

- `expression-*-candidate.json` and `expression-baseline.json` are complete
  **diagnostic-only** replays of the same 882 cached Quick inputs. No behavior
  pass is inferred from these files. Their `deltas` field refers to an older
  72.29585059948458% baseline internal to the replay tool; compare `quality`
  against `expression-baseline.json` for this change's effect.
- `diagnostic-pairs.json.gz` records each profile's old/new quality and output
  SHA-256. No benchmark input or scoring rule was changed.
- `expression-native-first.json` preserves the first observations, including
  the invalid table comparison in the initially authored loop control.
- `expression-native-completed.json` preserves the first valid loop inputs:
  baseline and candidate fail all 12 loop profiles because of the preexisting
  repeat environment error; both pass the 12 original format controls.
- `expression-native-repeat-fixed.json` records the repeat repair: 24/24.
- `interpolation-review-first.json` preserves independent review's 12 parser
  failures on the first interpolation candidate; baseline passed 12/12.
  `interpolation-review-fixed.json` records 12/12 on the real corrected motor
  snapshot, with the same source/input bytes.
- `expression-native-final.json` reruns all three valid authored programs:
  baseline 24/36, candidate 36/36, with exact native traces and zero statuses.
- `loop-environment-review-first.json` preserves the independent review of REF
  cells, close-on-exit captures, exported exit writes and shared exit guards:
  baseline and candidate both pass 12/12.
- `expression-native-reviewed.json` reruns all four valid programs together:
  baseline 36/48, candidate 48/48, including those independent loop controls.
- `native-evidence.tar.gz` preserves complete original/decompiled sources,
  bytecode, raw traces, commands and first/fixed reports. VM executables and
  generated dist bundles are omitted; build commands, pins and hashes remain.
- The first and corrected full test logs preserve presentation assertion
  changes. Literal-receiver tests explicitly disable the optional interpolation
  presentation to keep exercising fallback syntax. The terminal-loop test now
  requires the selected guard's final `break` after its nested empty return.

Final replay: **77.54035791437101%**, up **0.04449662437785 percentage points**;
token ratio **0.978417229179775**. This directory does not claim a strict Quick
runtime result, an independent holdout pass, or 100% source recovery.
