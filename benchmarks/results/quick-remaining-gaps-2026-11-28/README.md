# Closed Quick similarity investigations

This compact archive records a diagnostic census, not an engine patch or a
new behavioral pass. The [conclusion](../../../docs/references/quick-remaining-gaps.md)
separates the strict `885eb08` baseline from the unverified AST projections and
from subsequent integrated results measured independently.

## Contents

- [baseline-strict-receipt.json](baseline-strict-receipt.json) extracts the
  original strict result's identity, aggregate quality and all-pass counts;
  it includes the original file's path, size and SHA-256.
- [baseline-strict-provenance.json](baseline-strict-provenance.json) and
  [baseline-replay-summary.json](baseline-replay-summary.json) are byte-exact
  copies of their existing source files. The strict run passed 882/882;
  the diagnostic replay reproduced 77.25692801599871% similarity.
- [summary.json](summary.json), [interpretation.json](interpretation.json)
  and [first-run.log](first-run.log) preserve the existing census outputs.
- [numeric-records.json.gz](numeric-records.json.gz) retains all 300 generated
  profiles: baseline/projected quality, every transformation event, and hashes
  of the input bytecodes, original records and source/output strings. This is
  an explicitly compact extraction, not a lossless archive of those strings.
- [nonadjacent-temp-census.mjs](nonadjacent-temp-census.mjs) is the exact
  executed diagnostic script. [provenance.json](provenance.json) records its
  hash, engine/scorer identity, input paths and reconstruction command.
- [extract-numeric-records.py](extract-numeric-records.py) produced the compact
  extraction and recomputed its aggregate counts/deltas against the original
  summary. [archive-validation.json](archive-validation.json) records the
  completed archival checks; it does not add a behavioral certification.
- [compressed-files.json](compressed-files.json) records uncompressed and
  compressed sizes/hashes. Gzip uses `mtime=0`; its decompressed bytes were
  compared with the compact extraction. [SHA256SUMS](SHA256SUMS) covers every
  archived file except itself.

The three projections respectively move 17, 46 and 1,063 declarations for
global Quick deltas of +0.00111443790989, +0.00447028077919 and
+0.02321058930724 percentage points. The third deliberately crosses
potentially effectful stores. None was runtime-certified. All preserve the
882-profile denominator, with the other 582 profiles unchanged. The numeric
records reproduce these aggregates exactly without retaining duplicate
sources in Git.

## Original records and reproduction

Workspace root: `/workspace/scratch/eb5e4be57451/`.

- First complete records: `quality-research/nonadjacent-temps-885-first/`.
- Uncompressed compact extraction: `quality-research/nonadjacent-temps-885-first-numeric-records.json`.
- Baseline cache: `quality-research/current-885eb08-quick/records/`.
- Immutable baseline engine: `quality-research/current-885eb08-quick/engine-dist/`.
- Strict result: `measurements/similarity-v2-quick-885eb08/annonyA-quick.json`.

The script accepts `dist records output-directory`; it refuses an existing
output directory and uses the pinned scorer path recorded in provenance.
A reproduction command is recorded there. Reproduction needs the sealed
baseline cache, engine snapshot and scorer. The recorded source/output hashes
allow each compact row to be checked against its intact first observation.
No new census, runtime check or benchmark was executed while archiving this
note. The older pure-helper rejection and native REF-capture controls remain
in their existing linked reports rather than being duplicated here.
