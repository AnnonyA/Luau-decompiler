# Three-engine comparison against authored originals

Compiler revision (declared): 9d7748a4f324213a18cb8283fa2a77c330225fa0. Profiles: O0/O1, debug level 1.
Each of the 12 independent programs runs with three inputs. MATCH means identical observed traces, not universal equivalence.
No ranking is assigned to unmeasured engines. Structural/token metrics are secondary lexical diagnostics, not semantic scores.

| Program | O | AnnonyA | LunaUX | Lua.Expert |
|---|---:|---|---|---|
| ledger | 0 | MATCH | MATCH | MATCH |
| ledger | 1 | MATCH | MATCH | MATCH |
| dispatch | 0 | MATCH | MATCH | MATCH |
| dispatch | 1 | MATCH | MATCH | MATCH |
| recursive-parser | 0 | MATCH | MATCH | MATCH |
| recursive-parser | 1 | MATCH | MATCH | MATCH |
| pack-pipeline | 0 | MATCH | MATCH | MATCH |
| pack-pipeline | 1 | MATCH | MATCH | MATCH |
| matrix-scope | 0 | MATCH | MATCH | MATCH |
| matrix-scope | 1 | MATCH | MATCH | MATCH |
| rollback | 0 | MATCH | MATCH | MATCH |
| rollback | 1 | MATCH | MATCH | MATCH |
| codec | 0 | MATCH | MATCH | MATCH |
| codec | 1 | MATCH | MATCH | MATCH |
| graph-walk | 0 | MATCH | MATCH | MATCH |
| graph-walk | 1 | MATCH | MATCH | MATCH |
| iterator-state | 0 | MATCH | MATCH | MATCH |
| iterator-state | 1 | MATCH | MATCH | MATCH |
| branch-phis | 0 | MATCH | MATCH | MATCH |
| branch-phis | 1 | MATCH | MATCH | MATCH |
| shadowed-constants | 0 | MATCH | MATCH | MATCH |
| shadowed-constants | 1 | MATCH | MATCH | MATCH |
| effect-schedule | 0 | MATCH | MATCH | MATCH |
| effect-schedule | 1 | MATCH | MATCH | MATCH |

## Evidence

| Program/profile | Engine | Matching inputs | Normalized token similarity | Time (ms) |
|---|---|---:|---:|---:|
| ledger/O0 | annony | 3/3 | 0.801 | 22.5 |
| ledger/O0 | lunaux | 3/3 | 0.791 | 611.4 |
| ledger/O0 | luaexpert | 3/3 | 0.853 | 359.9 |
| ledger/O1 | annony | 3/3 | 0.810 | 4.0 |
| ledger/O1 | lunaux | 3/3 | 0.791 | 460.3 |
| ledger/O1 | luaexpert | 3/3 | 0.853 | 320.3 |
| dispatch/O0 | annony | 3/3 | 0.665 | 3.8 |
| dispatch/O0 | lunaux | 3/3 | 0.783 | 380.3 |
| dispatch/O0 | luaexpert | 3/3 | 0.840 | 511.2 |
| dispatch/O1 | annony | 3/3 | 0.730 | 2.7 |
| dispatch/O1 | lunaux | 3/3 | 0.783 | 428.2 |
| dispatch/O1 | luaexpert | 3/3 | 0.840 | 358.9 |
| recursive-parser/O0 | annony | 3/3 | 0.669 | 3.4 |
| recursive-parser/O0 | lunaux | 3/3 | 0.739 | 326.7 |
| recursive-parser/O0 | luaexpert | 3/3 | 0.896 | 368.7 |
| recursive-parser/O1 | annony | 3/3 | 0.747 | 2.4 |
| recursive-parser/O1 | lunaux | 3/3 | 0.739 | 287.8 |
| recursive-parser/O1 | luaexpert | 3/3 | 0.872 | 372.2 |
| pack-pipeline/O0 | annony | 3/3 | 0.732 | 3.2 |
| pack-pipeline/O0 | lunaux | 3/3 | 0.847 | 404.4 |
| pack-pipeline/O0 | luaexpert | 3/3 | 0.955 | 283.0 |
| pack-pipeline/O1 | annony | 3/3 | 0.748 | 2.6 |
| pack-pipeline/O1 | lunaux | 3/3 | 0.847 | 383.0 |
| pack-pipeline/O1 | luaexpert | 3/3 | 0.955 | 354.2 |
| matrix-scope/O0 | annony | 3/3 | 0.714 | 2.8 |
| matrix-scope/O0 | lunaux | 3/3 | 0.955 | 235.3 |
| matrix-scope/O0 | luaexpert | 3/3 | 1.000 | 231.0 |
| matrix-scope/O1 | annony | 3/3 | 0.758 | 2.2 |
| matrix-scope/O1 | lunaux | 3/3 | 0.955 | 271.0 |
| matrix-scope/O1 | luaexpert | 3/3 | 1.000 | 318.6 |
| rollback/O0 | annony | 3/3 | 0.696 | 2.4 |
| rollback/O0 | lunaux | 3/3 | 0.985 | 299.4 |
| rollback/O0 | luaexpert | 3/3 | 0.940 | 249.9 |
| rollback/O1 | annony | 3/3 | 0.753 | 2.3 |
| rollback/O1 | lunaux | 3/3 | 0.883 | 176.0 |
| rollback/O1 | luaexpert | 3/3 | 0.825 | 260.3 |
| codec/O0 | annony | 3/3 | 0.709 | 2.0 |
| codec/O0 | lunaux | 3/3 | 0.957 | 215.4 |
| codec/O0 | luaexpert | 3/3 | 1.000 | 422.4 |
| codec/O1 | annony | 3/3 | 0.667 | 1.7 |
| codec/O1 | lunaux | 3/3 | 0.957 | 195.9 |
| codec/O1 | luaexpert | 3/3 | 0.957 | 408.2 |
| graph-walk/O0 | annony | 3/3 | 0.655 | 3.3 |
| graph-walk/O0 | lunaux | 3/3 | 0.854 | 347.3 |
| graph-walk/O0 | luaexpert | 3/3 | 0.930 | 260.9 |
| graph-walk/O1 | annony | 3/3 | 0.688 | 2.7 |
| graph-walk/O1 | lunaux | 3/3 | 0.854 | 170.0 |
| graph-walk/O1 | luaexpert | 3/3 | 0.930 | 388.5 |
| iterator-state/O0 | annony | 3/3 | 0.644 | 1.5 |
| iterator-state/O0 | lunaux | 3/3 | 0.845 | 179.4 |
| iterator-state/O0 | luaexpert | 3/3 | 1.000 | 271.9 |
| iterator-state/O1 | annony | 3/3 | 0.777 | 1.6 |
| iterator-state/O1 | lunaux | 3/3 | 0.845 | 227.0 |
| iterator-state/O1 | luaexpert | 3/3 | 1.000 | 290.6 |
| branch-phis/O0 | annony | 3/3 | 0.527 | 2.1 |
| branch-phis/O0 | lunaux | 3/3 | 0.790 | 161.3 |
| branch-phis/O0 | luaexpert | 3/3 | 0.794 | 268.0 |
| branch-phis/O1 | annony | 3/3 | 0.563 | 1.9 |
| branch-phis/O1 | lunaux | 3/3 | 0.711 | 191.2 |
| branch-phis/O1 | luaexpert | 3/3 | 0.795 | 203.1 |
| shadowed-constants/O0 | annony | 3/3 | 0.780 | 1.3 |
| shadowed-constants/O0 | lunaux | 3/3 | 0.859 | 392.5 |
| shadowed-constants/O0 | luaexpert | 3/3 | 1.000 | 177.0 |
| shadowed-constants/O1 | annony | 3/3 | 0.869 | 1.8 |
| shadowed-constants/O1 | lunaux | 3/3 | 0.820 | 391.9 |
| shadowed-constants/O1 | luaexpert | 3/3 | 0.962 | 203.2 |
| effect-schedule/O0 | annony | 3/3 | 0.735 | 2.8 |
| effect-schedule/O0 | lunaux | 3/3 | 0.932 | 167.5 |
| effect-schedule/O0 | luaexpert | 3/3 | 0.974 | 192.1 |
| effect-schedule/O1 | annony | 3/3 | 0.832 | 3.1 |
| effect-schedule/O1 | lunaux | 3/3 | 0.932 | 248.5 |
| effect-schedule/O1 | luaexpert | 3/3 | 0.974 | 240.0 |

Times are single observations: HTTP elapsed time includes transport; local time measures decompilation. They are not a fair throughput benchmark.
All sources, exact bytecode, hashes, request/response records, traces and lexical counts are in report.json and sibling artifacts.
Binding/capture correctness and lost effects are exercised by input-specific traces; static scope equivalence is not established.

