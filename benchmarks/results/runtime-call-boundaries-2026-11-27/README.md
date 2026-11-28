# Runtime call presentation observations

This archive covers the independently implemented bounded printer proof in
[`runtime-call-boundaries.md`](../../../docs/references/runtime-call-boundaries.md).
The measured baseline is main `36a344eeed74d194723e6f32a0ef7d699fac550f`.
The candidate changes only `src/print/CallBoundaries.ts` in the engine. Its
source-file hash and complete diagnostic distribution fingerprint are in
[`quality-comparison.json`](quality-comparison.json).

| Measurement | Baseline | Candidate |
| --- | ---: | ---: |
| Initial authored controls, both official pins | 24/24 | 24/24 |
| Complete authored controls, including scalar inlining | 36/36 | 36/36 |
| Diagnostic Quick similarity, 882 pairs | 76.92827095114995% | 76.96879834207007% |
| Diagnostic geometric token-size ratio | 0.9927495865084095 | 0.991644135528782 |
| Strict Quick behavior | 882/882 (published baseline) | 882/882 |

The diagnostic replay uses unchanged pinned Rosetta metric and lexer sources.
It is not a behavioral run. The test corpus, profiles, metric, engine options
and defaults are unchanged. Full and Hard tier results for this candidate are
not claimed here. There is no speed comparison.

## Raw observations

- [`original-observations.json`](original-observations.json) and
  [`candidate-observations.json`](candidate-observations.json) preserve the first
  24-profile observations before the scalar-position control was added.
- [`original-observations-complete.json`](original-observations-complete.json)
  and [`candidate-observations-complete.json`](candidate-observations-complete.json)
  contain all 36 original/result traces, recovered source, compile status,
  SHA-256 hashes and base64-encoded recompiled bytes.
- The unchanged original source and 36 bytecode inputs are pinned by
  [`manifest.json`](../../../tests/fixtures/runtime-call-boundaries/manifest.json).
- [`diagnostic-replay.json`](diagnostic-replay.json) is the raw replay summary.
  Its legacy `baselineQuality` field refers to the earlier capture engine,
  whose bytes were reused; [`quality-comparison.json`](quality-comparison.json)
  compares the current main output with this candidate explicitly.
- [`c875-scalar-inlining-remarks.txt`](c875-scalar-inlining-remarks.txt) and
  [`9d-scalar-inlining-remarks.txt`](9d-scalar-inlining-remarks.txt) confirm actual
  compiler inlining in the authored scalar-position source.

Absolute workspace paths are provenance metadata, not required input files.
The fixture manifest and embedded output bytes make the behavioral observations
inspectable independently of those paths. After first observation these sources
are development regressions; they are not fresh blind evaluations.

## Strict Quick and local validation

The unchanged pinned Quick suite passes **882/882**, with zero mismatches,
recompile errors, decompile errors, refusals or unusable inputs. Its four
sections pass 246/246, 36/36, 300/300 and 300/300. See the untouched
[`raw report`](annonyA-quick.json), [`provenance`](annonyA-quick.provenance.json)
and [`log`](strict-quick-log.txt). The strict run independently reproduces
76.96879834207007% similarity and a 0.9916441355287821 token-size ratio.

This development measurement ran from the documented dirty feature worktree,
not from the unchanged baseline commit named in its `revision` field. Its
actual source/distribution hashes were verified again after the run and are
recorded in `quality-comparison.json`. Only the call-boundary source file
differs in the engine; documentation and authored test files do not enter
that source fingerprint.

Node 22.23.5 compiled the measured engine successfully. The complete unit run
passed 1,548/1,548 tests in 146 files before the final fixture-manifest test was
added ([log](unit-log.txt)); the final focused run passed all 70 tests in five
files, including that additional test ([log](focused-unit-log.txt)). The
complete official round trips above also pass independently. Node 20 and
full integrated CI gates are delegated to the parent integration; they are
not claimed by this local archive.
