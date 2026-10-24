# Large original systems: measured comparison

Each profile uses 12 deterministic inputs. MATCH means the official VM produced identical observable traces on those inputs, not universal equivalence.
Partition labels record evaluation provenance. Development and development-regression cases informed fixes; only a first frozen holdout run is blind evidence. Do not pool tuned results as a blind generalization score.

| Program | Partition | O | AnnonyA before | AnnonyA after | LunaUX | Lua.Expert |
|---|---|---:|---|---|---|---|
| protocol-router | development | 0 | MATCH | MATCH | MATCH | MATCH |
| protocol-router | development | 1 | MATCH | MATCH | MATCH | MATCH |
| protocol-router | development | 2 | MATCH | MATCH | MATCH | MATCH |
| transaction-store | development | 0 | MATCH | MATCH | MISMATCH | MATCH |
| transaction-store | development | 1 | MATCH | MATCH | MISMATCH | MATCH |
| transaction-store | development | 2 | MATCH | MATCH | MISMATCH | MATCH |
| workflow-scheduler | development | 0 | MATCH | MATCH | MATCH | MATCH |
| workflow-scheduler | development | 1 | MATCH | MATCH | MATCH | MATCH |
| workflow-scheduler | development | 2 | MATCH | MATCH | MATCH | MATCH |
| query-planner | development-regression | 0 | MISMATCH | MATCH | MATCH | MATCH |
| query-planner | development-regression | 1 | MISMATCH | MATCH | MATCH | MATCH |
| query-planner | development-regression | 2 | MISMATCH | MATCH | MATCH | MATCH |
| reactive-simulation | development-regression | 0 | MISMATCH | MATCH | MISMATCH | MATCH |
| reactive-simulation | development-regression | 1 | MISMATCH | MATCH | MISMATCH | MATCH |
| reactive-simulation | development-regression | 2 | MISMATCH | MATCH | MISMATCH | MATCH |

| Engine | Matching profiles | Matching input runs |
|---|---:|---:|
| annony | 15/15 | 180/180 |
| lunaux | 9/15 | 108/180 |
| luaexpert | 15/15 | 180/180 |

| Program/O | Local decompile ms | Worker peak MiB | Bytecode KiB |
|---|---:|---:|---:|
| protocol-router/O0 | 205.8 | 99.2 | 43.0 |
| protocol-router/O1 | 219.3 | 97.8 | 40.8 |
| protocol-router/O2 | 213.5 | 101.5 | 59.3 |
| transaction-store/O0 | 242.5 | 100.3 | 45.5 |
| transaction-store/O1 | 169.7 | 82.6 | 42.5 |
| transaction-store/O2 | 203.2 | 101.9 | 49.5 |
| workflow-scheduler/O0 | 257.2 | 103.8 | 49.9 |
| workflow-scheduler/O1 | 250.3 | 100.2 | 48.1 |
| workflow-scheduler/O2 | 335.3 | 90.0 | 62.8 |
| query-planner/O0 | 243.4 | 114.6 | 44.1 |
| query-planner/O1 | 245.7 | 94.2 | 40.8 |
| query-planner/O2 | 264.3 | 97.7 | 72.4 |
| reactive-simulation/O0 | 207.0 | 95.7 | 44.0 |
| reactive-simulation/O1 | 228.5 | 97.5 | 41.2 |
| reactive-simulation/O2 | 261.8 | 99.6 | 66.4 |

Times are single measurements. Worker peak includes diagnostic AST/disassembly extraction. API latency includes network transport and cannot establish comparative engine speed.
Structural counts and normalized-token similarities are in summary.json; they are lexical diagnostics and do not certify binding equivalence or readability. Full VM traces, bytecode, raw/final AST sources, disassembly and API bodies are preserved in evidence.tar.gz.
