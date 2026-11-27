# Debug declaration recovery — development checkpoint

The engine recovers parallel local declarations from the bytecode's original
debug boundaries and transfers a complete one-use temporary tuple to its source
names. See [the engineering note](../../../docs/references/debug-parallel-declarations.md)
for the proof and exclusions.

| Pinned Rosetta tier | Before | After | Similarity before | Similarity after | Size after |
| --- | ---: | ---: | ---: | ---: | ---: |
| Quick | 882/882 | 882/882 | 72.295851% | 72.349280% | 1.100561× |
| Hard Quick | 882/882 | 882/882 | 71.814628% | 71.846268% | 1.107984× |

The gains are incremental. Quick name recovery rises from59.482002% to60.836992%;
Hard Quick rises from29.367867% to29.967808%. A time-limited Myers comparison can
vary on the largest generated programs; the raw full-tier measurements above
are retained rather than replacing them with higher diagnostic replay values.
The baseline is the previously sealed main engine dc4d32d.

Four project-authored programs pass48/48 normal and Hard profiles on both the
baseline and candidate. Their aggregate similarity moves from74.088974% to
75.366049%; name recovery moves from37.431694% to51.36612021857923%. The sealed
sources and bytecodes are under `tests/fixtures/debug-declarations`.

The final unit run passes1330/1330 tests in135 files. An initial candidate failed
one unchanged register-pressure test because it retained both a temporary tuple
and its complete scalar copy; `initial-unit.log` preserves that observation.
The final tuple proof removes that duplicate without changing the test.

`source-hashes.json` identifies every source file in the immutable dist snapshot
used for both benchmark commands. The final working engine was checked against
all these hashes. The copied snapshot used default CLI options and the unchanged
Rosetta80f3 pin, with four workers per tier. Results are a development checkpoint,
not the final combined-engine publication. `SHA256SUMS` seals the raw evidence.
