# Private primitive region recovery

Base: `36a344eeed74d194723e6f32a0ef7d699fac550f`.
The unchanged Rosetta 3 corpus/scorer and empty query/options were used.

| Quick diagnostic metric | Base | Candidate |
| --- | ---: | ---: |
| Source similarity | 76.9282709511% | 76.9446880098% |
| Geometric token-size ratio | 0.9927495865 | 0.9924414854 |
| Outputs changed | — | 4 / 882 |

The gain is **0.0164170587 percentage points**. The four changed profiles are
the O2g1/O2g2 copies of `control_flow` and `loops`; 878 outputs are byte-identical
to the baseline diagnostic output. No scorer, corpus, runner, validator or
option default changed.

Validation is deliberately reported separately:

- Authored control: baseline **12/12**, candidate **12/12**, including all six
  normal and six Hard profiles.
- Copied Quick-source regression: **1,764/1,764**, with no mismatch, parse failure,
  decompile failure, refusal or unusable input.
- Full engine units: **1,565/1,565** in 146 files. After the final register-bound
  control and sealed-fixture tests were added, the unchanged engine also passed
  the complete **39/39** focused tests in two files.

The source regression is not an official four-tier release benchmark. The
quality replay itself does not execute bytecode; its original
`behaviorVerified: false` distinction is preserved in `validation.json`.

Files:

- `quality-comparison.json`: exact metrics and four changed-profile deltas.
- `authored-runtime.json`: official Rosetta runtime observations for the
  project-authored fixture, with both baseline and candidate.
- `quick-hard-regression.json`: source regression result for 147 existing
  Quick sources and twelve profiles.
- `validation.json`: engine/source hashes, counts, scope and commands.

The implementation and safety limits are described in
[`primitive-region-recovery.md`](../../../docs/references/primitive-region-recovery.md).
The earlier v1 source/report and complete diagnostic caches remain separate
development evidence in `similarity-v2-regions-probes`; they are not overwritten
or copied wholesale into the repository.
