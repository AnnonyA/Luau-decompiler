# Large original systems: measured comparison

Each profile uses 12 deterministic inputs. MATCH means the official VM produced identical observable traces on those inputs, not universal equivalence.
Partition labels record evaluation provenance. Development and development-regression cases informed fixes; only a first frozen holdout run is blind evidence. Do not pool tuned results as a blind generalization score.

| Program | Partition | O | AnnonyA before | AnnonyA after | LunaUX | Lua.Expert |
|---|---|---:|---|---|---|---|
| archive-filesystem | development | 0 | NO MEDIDO | MISMATCH | MATCH | MATCH |
| archive-filesystem | development | 1 | NO MEDIDO | MISMATCH | MATCH | MATCH |
| archive-filesystem | development | 2 | NO MEDIDO | MISMATCH | MISMATCH | MATCH |
| document-layout | development | 0 | NO MEDIDO | MISMATCH | MATCH | MATCH |
| document-layout | development | 1 | NO MEDIDO | MISMATCH | MATCH | MATCH |
| document-layout | development | 2 | NO MEDIDO | MISMATCH | MATCH | MATCH |
| symbolic-algebra | development | 0 | NO MEDIDO | MISMATCH | MISMATCH | MATCH |
| symbolic-algebra | development | 1 | NO MEDIDO | MISMATCH | MISMATCH | MATCH |
| symbolic-algebra | development | 2 | NO MEDIDO | MISMATCH | MISMATCH | MATCH |
| constraint-search | holdout | 0 | NO MEDIDO | MISMATCH | MATCH | MATCH |
| constraint-search | holdout | 1 | NO MEDIDO | INVALID | MATCH | MATCH |
| constraint-search | holdout | 2 | NO MEDIDO | INVALID | MISMATCH | MATCH |
| geometry-pipeline | holdout | 0 | NO MEDIDO | MISMATCH | MATCH | MATCH |
| geometry-pipeline | holdout | 1 | NO MEDIDO | MISMATCH | MATCH | MATCH |
| geometry-pipeline | holdout | 2 | NO MEDIDO | MISMATCH | MATCH | MATCH |

| Engine | Matching profiles | Matching input runs |
|---|---:|---:|
| annony | 0/15 | 0/180 |
| lunaux | 10/15 | 120/180 |
| luaexpert | 15/15 | 180/180 |

| Program/O | Local decompile ms | Worker peak MiB | Bytecode KiB |
|---|---:|---:|---:|
| archive-filesystem/O0 | 329.1 | 94.4 | 54.9 |
| archive-filesystem/O1 | 362.4 | 105.4 | 52.7 |
| archive-filesystem/O2 | 305.3 | 132.0 | 77.6 |
| document-layout/O0 | 392.3 | 135.0 | 89.9 |
| document-layout/O1 | 322.0 | 134.3 | 79.7 |
| document-layout/O2 | 364.4 | 136.8 | 108.1 |
| symbolic-algebra/O0 | 317.5 | 89.4 | 60.0 |
| symbolic-algebra/O1 | 296.9 | 96.4 | 56.0 |
| symbolic-algebra/O2 | 615.2 | 159.4 | 138.3 |
| constraint-search/O0 | 206.1 | 93.4 | 35.5 |
| constraint-search/O1 | 179.2 | 90.4 | 33.2 |
| constraint-search/O2 | 261.7 | 100.3 | 42.3 |
| geometry-pipeline/O0 | 384.8 | 131.6 | 45.1 |
| geometry-pipeline/O1 | 385.7 | 141.2 | 43.0 |
| geometry-pipeline/O2 | 589.4 | 153.1 | 76.7 |

Times are single measurements. Worker peak includes diagnostic AST/disassembly extraction. API latency includes network transport and cannot establish comparative engine speed.
Structural counts and normalized-token similarities are in summary.json; they are lexical diagnostics and do not certify binding equivalence or readability. Full VM traces, bytecode, raw/final AST sources, disassembly and API bodies are preserved in evidence.tar.gz.
