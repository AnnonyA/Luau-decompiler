# Development checkpoints retained before final measurement

These files are intermediate observations. They are not four-tier
release results and are not combined to manufacture a score for one engine.
The [integrated Quick report](../README.md) records the later strict result.

## First integrated strict Quick

[Raw result](phase1-quick/annonyA-quick.json) and
[provenance](phase1-quick/annonyA-quick.provenance.json) retain the first combined
boolean/parallel-assignment run: **882/882** usable pairs pass, with
**77.11222780669897%** similarity. The source revision is
`f701849aa4e304e7a14733c02300e92a4edd77ea`.

The original status is correctly retained as `+dirty`: its only untracked path
was a `node_modules` symlink. Engine source and distribution digests remained
stable during the run. Later clean measurement worktrees use real dependency
directories; this first record is not relabeled as a clean final execution.

## Rejected compound-operator spelling

The experiment admitted literal-only `//=` and `^=`. Its authored baseline and
candidate each passed 12/12 normal/Hard profiles, but the unchanged Quick metric
fell from **77.11222780669897%** to **77.10881640040685%**. The experiment was
removed from the engine. Its patch, independent sources, sealed bytecode,
[decision](compound-rejected/decision.json), and original unit source (as text,
so it is not accidentally run as a production test) remain in this directory.
The diagnostic is not a behavioral execution of the whole Quick corpus.

The boolean, parallel assignment, runtime-call, primitive-region and table
archives retain their separate first failures and diagnostic measurements. Further development is now focused exclusively on Quick, as requested. No
new result for Full or either Hard tier is inferred from these changes.

## Clean integrated Quick checkpoint

The [885eb08 checkpoint](integrated-885-quick/summary.json) measures a clean,
immutable checkout with Node 22.23.5. Quick passes **882/882**, with
**77.25692801599871% source similarity** and geometric token ratio
**0.9854781501051265**. The separate unit run passes **1,800/1,800** tests
in 154 files. Raw reports, original logs, provenance and hashes are retained.

This is **+0.32865706484876 percentage points** relative to the published
76.92827095114995% baseline. **100% source similarity is not reached.**
The behavioral pass percentage is a separate measure. Subsequent candidates
are measured separately; their individual gains must not be added to this
checkpoint without testing the combined engine.
