# Large original systems: five-program pilot

Each profile uses 12 deterministic inputs. MATCH means the official VM produced identical observable traces on those inputs, not universal equivalence.
Development cases informed engine fixes; reserved cases were first evaluated after the recorded engine freeze. They must not be pooled as a blind generalization score.

| Program | Partition | O | AnnonyA before | AnnonyA after | LunaUX | Lua.Expert |
|---|---|---:|---|---|---|---|
| protocol-router | development | 0 | MISMATCH | MATCH | MATCH | MATCH |
| protocol-router | development | 1 | MISMATCH | MATCH | MATCH | MATCH |
| protocol-router | development | 2 | MISMATCH | MATCH | MATCH | MATCH |
| transaction-store | development | 0 | MISMATCH | MATCH | MISMATCH | MATCH |
| transaction-store | development | 1 | MISMATCH | MATCH | MISMATCH | MATCH |
| transaction-store | development | 2 | MISMATCH | MATCH | MISMATCH | MATCH |
| workflow-scheduler | development | 0 | MISMATCH | MATCH | MATCH | MATCH |
| workflow-scheduler | development | 1 | MISMATCH | MATCH | MATCH | MATCH |
| workflow-scheduler | development | 2 | MISMATCH | MATCH | MATCH | MATCH |
| query-planner | holdout | 0 | NO MEDIDO | MISMATCH | MATCH | MATCH |
| query-planner | holdout | 1 | NO MEDIDO | MISMATCH | MATCH | MATCH |
| query-planner | holdout | 2 | NO MEDIDO | MISMATCH | MATCH | MATCH |
| reactive-simulation | holdout | 0 | NO MEDIDO | MISMATCH | MISMATCH | MATCH |
| reactive-simulation | holdout | 1 | NO MEDIDO | MISMATCH | MISMATCH | MATCH |
| reactive-simulation | holdout | 2 | NO MEDIDO | MISMATCH | MISMATCH | MATCH |

| Engine | Matching profiles | Matching input runs |
|---|---:|---:|
| annony | 9/15 | 108/180 |
| lunaux | 9/15 | 108/180 |
| luaexpert | 15/15 | 180/180 |

| Program/O | Local decompile ms | Worker peak MiB | Bytecode KiB |
|---|---:|---:|---:|
| protocol-router/O0 | 211.8 | 110.0 | 43.0 |
| protocol-router/O1 | 160.8 | 80.9 | 40.8 |
| protocol-router/O2 | 208.8 | 118.2 | 59.3 |
| transaction-store/O0 | 206.8 | 109.2 | 45.5 |
| transaction-store/O1 | 166.8 | 129.6 | 42.5 |
| transaction-store/O2 | 209.4 | 112.4 | 49.5 |
| workflow-scheduler/O0 | 253.4 | 114.6 | 49.9 |
| workflow-scheduler/O1 | 261.0 | 110.7 | 48.1 |
| workflow-scheduler/O2 | 295.4 | 108.7 | 62.8 |
| query-planner/O0 | 185.9 | 117.3 | 44.1 |
| query-planner/O1 | 208.1 | 112.3 | 40.8 |
| query-planner/O2 | 264.6 | 111.8 | 72.4 |
| reactive-simulation/O0 | 217.0 | 89.0 | 44.0 |
| reactive-simulation/O1 | 181.0 | 95.3 | 41.2 |
| reactive-simulation/O2 | 244.8 | 93.4 | 66.4 |

Times are single measurements. Worker peak includes diagnostic AST/disassembly extraction. API latency includes network transport and cannot establish comparative engine speed.
Structural counts and normalized-token similarities are in summary.json; they are lexical diagnostics and do not certify binding equivalence or readability. Full VM traces, bytecode, raw/final AST sources, disassembly and API bodies are preserved in evidence.tar.gz.
