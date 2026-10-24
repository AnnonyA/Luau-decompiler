# Second cohort: first frozen evaluation

| Engine | All profiles | Reserved profiles |
|---|---:|---:|
| AnnonyA | 0/15 MATCH | 0/6 MATCH |
| LunaUX | 10/15 MATCH | 5/6 MATCH |
| Lua.Expert | 15/15 MATCH | 6/6 MATCH |

These new results show a real generalization gap. AnnonyA's 15/15 on the first tuned pilot does not establish superiority. [Per-profile metrics](first-comparison.md) and [JSON](first-summary.json) preserve the first measurement; later tuning must not overwrite it. Constraint-search O1/O2 is INVALID for AnnonyA; the other 13 profiles are MISMATCH.

Development triage: document-layout loses the return inside Scope:get and its fallback path; archive-filesystem O0 emits constructor writes before its declaration, while O1/O2 later fail inside a traversal closure; symbolic-algebra O1/O2 corrupt nested conditional operands, and O0 fails a derivative assertion. The two reserved programs are not used for correction development in this round.

The five sources and 15 bytecode files were sealed before evaluation. Both engines received identical bytes, 30 new requests total, with full responses cached. Source files, manifests and original-validation traces are in `benchmarks/large/cohort2`. `first-evidence.tar.gz` contains original/reconstructed sources, exact bytecode, disassembly, raw AST reconstruction, parser results, traces and external responses. API documentation snapshots are also retained there. Expansion to 50 systems remains pending; the total is now ten independently authored large programs.

## Development follow-up before inspecting reserved implementations

[Follow-up comparison](development-comparison.md): **9/9 development MATCH**, all 108 input runs. Rechecking reserved cases without tuning on them still gives 0/6, so the complete second cohort is 9/15 vs cached LunaUX 10/15 and Lua.Expert 15/15. The first frozen 0/15 measurement remains unchanged.

General repairs: while continuations and exit polarity, parameter phis at function-entry backedges, O2 inlined normal-exit assignments, isolated elseif guard state, constructor field snapshots before callbacks/register reuse, fixed argument liveness before open CALL/RETURN/SETLIST tails, fresh phi owners for reused registers, captured aliases in deferred expressions, and preserved identity for multiply-read nested tables. Speculative value paths reject multiple-statement definitions rather than discard required snapshots.

The first pilot remains 15/15; 200/200, 24/24, 36/36 and all 63 small O0/O1/O2 profiles pass. Local unit suite: 373; benchmark suite: 39. Official parser: 25 local and 22 published references pass. Demo unit/browser checks pass. `development-evidence.tar.gz` records this build and all final checks. Merge remains blocked by the six second-cohort reserved failures, including two syntax failures. The next phase may promote these observed cases to development regressions, but cannot replace the first blind score.

## Subsequent observed regression round

The six observed failures were then promoted to development regressions and corrected. See the [2026-10-24 report](../cohort2-2026-10-24/README.md) for 15/15 tuned results, regression evidence and limitations. The first frozen measurement and this development-before-holdout snapshot remain unchanged.
