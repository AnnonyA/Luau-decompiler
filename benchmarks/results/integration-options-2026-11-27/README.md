# Integration option audit — 2026-11-27

Audited engine: `850211e4d011ea8610ccee2f7262f93b8fc94191`. The engine was built
in a separate clean checkout and remained unchanged throughout this audit.
This exercises the interaction of temporary provenance, primitive loop-result
defaults, scalar parentheses and iterator reconstruction.

## Results

| Configuration | Passed | Other verdicts |
| --- | ---: | ---: |
| Default engine options | 72/72 | 0 |
| Single-use temporary folding disabled | 72/72 | 0 |
| Plain reconstruction configuration below | 72/72 | 0 |
| Compact generated names, annotations off | 72/72 | 0 |
| **Total** | **288/288** | **0** |

The six unchanged authored sources come from `tests/fixtures/temporary-provenance`
(four programs), `tests/fixtures/loop-result-defaults` (one) and
`tests/fixtures/scalar-parentheses` (one). Every source runs at the six normal
profiles O0g1/O1g1/O2g1/O0g2/O1g2/O2g2 and the six pinned Hard profiles
O0g1+x1/O1g1+x2/O2g1+x3/O0g2+x2/O1g2+x3/O2g2+x1.

The plain configuration disables single-use folding, if expressions, early
returns, early continues, annotations, module-table unfolding, inline-function
recovery and runtime context. The complete exact option strings are retained in
`wrapper-original.mjs`. That wrapper directly uses the public API and formatter
from the audited engine, with a fixed presentation timestamp. Its absolute
invocation is retained below; its relative imports describe the original
workspace layout. No environment override was supplied and no engine, fixture,
assertion or compiler source was changed.

```sh
RAYON_NUM_THREADS=4 rosetta check tests/fixtures/temporary-provenance tests/fixtures/loop-result-defaults tests/fixtures/scalar-parentheses --profiles O0g1,O1g1,O2g1,O0g2,O1g2,O2g2,O0g1+x1,O1g1+x2,O2g1+x3,O0g2+x2,O1g2+x3,O2g2+x1 --decompiler 'default=node /workspace/scratch/eb5e4be57451/similarity-locals-probes/integration-options.mjs default {}' --decompiler 'nofold=node /workspace/scratch/eb5e4be57451/similarity-locals-probes/integration-options.mjs nofold {}' --decompiler 'plain=node /workspace/scratch/eb5e4be57451/similarity-locals-probes/integration-options.mjs plain {}' --decompiler 'compact=node /workspace/scratch/eb5e4be57451/similarity-locals-probes/integration-options.mjs compact {}' --report integration-options-850211e.json --work integration-options-850211e-failures
```

`report.json` and `runtime.log` preserve the complete original result. Its totals
were checked explicitly as 72 passes and no other verdict in each configuration.
The `rosetta check` process exited zero. There were no failure artifacts to retain.
`build.log` is the complete build log; `source-hashes.json` identifies the actual
source/configuration bytes used. `SHA256SUMS` seals every evidence file.

This is a targeted integration audit, not a Quick/Full/HardQuick/HardFull tier
result. The readability metrics in the raw authored report must not be presented
as the overall Rosetta source-similarity score. The final combined engine still
requires its own four strict tiers and required Node20/22, parser/runtime and
browser validation.
