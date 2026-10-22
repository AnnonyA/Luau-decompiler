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
| protocol-router/O0 | 215.0 | 101.2 | 43.0 |
| protocol-router/O1 | 188.5 | 85.5 | 40.8 |
| protocol-router/O2 | 245.7 | 115.5 | 59.3 |
| transaction-store/O0 | 215.9 | 108.9 | 45.5 |
| transaction-store/O1 | 191.9 | 105.5 | 42.5 |
| transaction-store/O2 | 192.2 | 114.4 | 49.5 |
| workflow-scheduler/O0 | 233.6 | 124.7 | 49.9 |
| workflow-scheduler/O1 | 258.5 | 120.7 | 48.1 |
| workflow-scheduler/O2 | 280.4 | 106.4 | 62.8 |
| query-planner/O0 | 201.8 | 116.1 | 44.1 |
| query-planner/O1 | 200.4 | 118.2 | 40.8 |
| query-planner/O2 | 293.8 | 105.2 | 72.4 |
| reactive-simulation/O0 | 191.5 | 99.9 | 44.0 |
| reactive-simulation/O1 | 183.4 | 91.1 | 41.2 |
| reactive-simulation/O2 | 204.9 | 91.8 | 66.4 |

Times are single measurements. Worker peak includes diagnostic AST/disassembly extraction. API latency includes network transport and cannot establish comparative engine speed.
Structural counts and normalized-token similarities are in summary.json; they are lexical diagnostics and do not certify binding equivalence or readability. Full VM traces, bytecode, raw/final AST sources, disassembly and API bodies are preserved in evidence.tar.gz.
