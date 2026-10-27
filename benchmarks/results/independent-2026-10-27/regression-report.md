# Three-engine comparison against authored originals

Compiler revision (declared): 9d7748a4f324213a18cb8283fa2a77c330225fa0. Profiles: O0/O1/O2, debug level 1.
3 programs; 9 profiles; 216 input executions per measured engine. MATCH means identical observed traces, not universal equivalence.
No ranking is assigned to unmeasured engines. Structural/token metrics are secondary lexical diagnostics, not semantic scores.

| Program | O | AnnonyA | LunaUX | Lua.Expert |
|---|---:|---|---|---|
| entity-store | 0 | MATCH | MATCH | MATCH |
| entity-store | 1 | MATCH | MATCH | MATCH |
| entity-store | 2 | MATCH | MATCH | MATCH |
| incremental-workbook | 0 | MATCH | MATCH | MATCH |
| incremental-workbook | 1 | MATCH | MATCH | MATCH |
| incremental-workbook | 2 | MATCH | MATCH | MATCH |
| streaming-audio | 0 | MATCH | MATCH | MATCH |
| streaming-audio | 1 | MATCH | MATCH | MATCH |
| streaming-audio | 2 | MATCH | MISMATCH | MATCH |

## Evidence

| Program/profile | Engine | Matching inputs | Normalized token similarity | Time (ms) |
|---|---|---:|---:|---:|
| entity-store/O0 | annony | 24/24 | 0.800 | 92.3 |
| entity-store/O0 | lunaux | 24/24 | 0.924 | 572.9 |
| entity-store/O0 | luaexpert | 24/24 | 0.934 | 1260.0 |
| entity-store/O1 | annony | 24/24 | 0.833 | 45.9 |
| entity-store/O1 | lunaux | 24/24 | 0.920 | 212.9 |
| entity-store/O1 | luaexpert | 24/24 | 0.932 | 1403.5 |
| entity-store/O2 | annony | 24/24 | 0.761 | 51.2 |
| entity-store/O2 | lunaux | 24/24 | 0.847 | 190.4 |
| entity-store/O2 | luaexpert | 24/24 | 0.863 | 841.3 |
| incremental-workbook/O0 | annony | 24/24 | 0.736 | 36.8 |
| incremental-workbook/O0 | lunaux | 24/24 | 0.961 | 354.1 |
| incremental-workbook/O0 | luaexpert | 24/24 | 0.960 | 1005.1 |
| incremental-workbook/O1 | annony | 24/24 | 0.753 | 36.8 |
| incremental-workbook/O1 | lunaux | 24/24 | 0.957 | 243.7 |
| incremental-workbook/O1 | luaexpert | 24/24 | 0.956 | 761.6 |
| incremental-workbook/O2 | annony | 24/24 | 0.728 | 55.6 |
| incremental-workbook/O2 | lunaux | 24/24 | 0.910 | 412.5 |
| incremental-workbook/O2 | luaexpert | 24/24 | 0.902 | 312.4 |
| streaming-audio/O0 | annony | 24/24 | 0.753 | 39.3 |
| streaming-audio/O0 | lunaux | 24/24 | 0.908 | 384.8 |
| streaming-audio/O0 | luaexpert | 24/24 | 0.938 | 1130.4 |
| streaming-audio/O1 | annony | 24/24 | 0.775 | 35.4 |
| streaming-audio/O1 | lunaux | 24/24 | 0.905 | 297.5 |
| streaming-audio/O1 | luaexpert | 24/24 | 0.934 | 837.0 |
| streaming-audio/O2 | annony | 24/24 | 0.654 | 36.0 |
| streaming-audio/O2 | lunaux | 0/24 | 0.763 | 284.6 |
| streaming-audio/O2 | luaexpert | 24/24 | 0.778 | 336.8 |

Times are single observations: HTTP elapsed time includes transport; local time measures decompilation. They are not a fair throughput benchmark.
All sources, exact bytecode, hashes, request/response records, traces and lexical counts are in report.json and sibling artifacts.
Binding/capture correctness and lost effects are exercised by input-specific traces; static scope equivalence is not established.

- streaming-audio/O2 lunaux: MISMATCH — execution error or different observable trace
