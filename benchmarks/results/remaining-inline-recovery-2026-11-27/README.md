# Remaining helper-region opportunity: diagnostic evidence

These are preserved measurements from intermediate engine 850211e (published
with the identical tree as eca5d231), **not final release scores or new
behavioral checks**. No engine, scorer, or VM was run for this aggregation.

[Investigation and proposed proof boundaries](../../../docs/references/remaining-inline-recovery.md)
explain the retained helper regions, exact bytecode observations and limitations.
`diagnostic-family.json` retains the 82 individual quality rows, original record
hashes, source/output hashes, and the two control-flow rows. It is sufficient
to recompute every aggregate in that note without copying the original cache.
The full source/output records were not copied. The original census, its script,
and the 850 summary are preserved byte for byte beside it. The census counts
potential helper bodies, not accepted recovery sites.

The helper-region gain is conditional and unimplemented. It neither establishes
that the 82.2%/90% targets are achievable with this design nor rules them out.

```python
import json, math
d = json.load(open("diagnostic-family.json"))
r = d["family"]
print(len(r), sum(x["quality"]["similarity"] for x in r) * 100 / len(r))
print(math.exp(sum(math.log(x["quality"]["size"]) for x in r) / len(r)))
print(sum(100 - x["quality"]["similarity"] * 100 for x in d["controlFlowProfiles"]) / 882)
```
