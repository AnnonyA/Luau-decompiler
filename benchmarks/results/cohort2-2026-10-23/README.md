# Second cohort: first frozen evaluation

| Engine | All profiles | Reserved profiles |
|---|---:|---:|
| AnnonyA | 0/15 MATCH | 0/6 MATCH |
| LunaUX | 10/15 MATCH | 5/6 MATCH |
| Lua.Expert | 15/15 MATCH | 6/6 MATCH |

These new results show a real generalization gap. AnnonyA's 15/15 on the first tuned pilot does not establish superiority. [Per-profile metrics](first-comparison.md) and [JSON](first-summary.json) preserve the first measurement; later tuning must not overwrite it. Constraint-search O1/O2 is INVALID for AnnonyA; the other 13 profiles are MISMATCH.

Development triage: document-layout loses the return inside Scope:get and its fallback path; archive-filesystem O0 emits constructor writes before its declaration, while O1/O2 later fail inside a traversal closure; symbolic-algebra O1/O2 corrupt nested conditional operands, and O0 fails a derivative assertion. The two reserved programs are not used for correction development in this round.

The five sources and 15 bytecode files were sealed before evaluation. Both engines received identical bytes, 30 new requests total, with full responses cached. Source files, manifests and original-validation traces are in `benchmarks/large/cohort2`. `first-evidence.tar.gz` contains original/reconstructed sources, exact bytecode, disassembly, raw AST reconstruction, parser results, traces and external responses. API documentation snapshots are also retained there. Expansion to 50 systems remains pending; the total is now ten independently authored large programs.
