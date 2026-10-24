# Large original systems: measured comparison

Each profile uses 12 deterministic inputs. MATCH means the official VM produced identical observable traces on those inputs, not universal equivalence.
Partition labels record evaluation provenance. Development and development-regression cases informed fixes; only a first frozen holdout run is blind evidence. Do not pool tuned results as a blind generalization score.

| Program | Partition | O | AnnonyA before | AnnonyA after | LunaUX | Lua.Expert |
|---|---|---:|---|---|---|---|
| archive-filesystem | development | 0 | MISMATCH | MATCH | MATCH | MATCH |
| archive-filesystem | development | 1 | MISMATCH | MATCH | MATCH | MATCH |
| archive-filesystem | development | 2 | MISMATCH | MATCH | MISMATCH | MATCH |
| document-layout | development | 0 | MISMATCH | MATCH | MATCH | MATCH |
| document-layout | development | 1 | MISMATCH | MATCH | MATCH | MATCH |
| document-layout | development | 2 | MISMATCH | MATCH | MATCH | MATCH |
| symbolic-algebra | development | 0 | MISMATCH | MATCH | MISMATCH | MATCH |
| symbolic-algebra | development | 1 | MISMATCH | MATCH | MISMATCH | MATCH |
| symbolic-algebra | development | 2 | MISMATCH | MATCH | MISMATCH | MATCH |
| constraint-search | holdout | 0 | MISMATCH | MISMATCH | MATCH | MATCH |
| constraint-search | holdout | 1 | INVALID | INVALID | MATCH | MATCH |
| constraint-search | holdout | 2 | INVALID | INVALID | MISMATCH | MATCH |
| geometry-pipeline | holdout | 0 | MISMATCH | MISMATCH | MATCH | MATCH |
| geometry-pipeline | holdout | 1 | MISMATCH | MISMATCH | MATCH | MATCH |
| geometry-pipeline | holdout | 2 | MISMATCH | MISMATCH | MATCH | MATCH |

| Engine | Matching profiles | Matching input runs |
|---|---:|---:|
| annony | 9/15 | 108/180 |
| lunaux | 10/15 | 120/180 |
| luaexpert | 15/15 | 180/180 |

| Program/O | Local decompile ms | Worker peak MiB | Bytecode KiB |
|---|---:|---:|---:|
| archive-filesystem/O0 | 326.8 | 93.4 | 54.9 |
| archive-filesystem/O1 | 296.5 | 98.6 | 52.7 |
| archive-filesystem/O2 | 307.2 | 128.7 | 77.6 |
| document-layout/O0 | 329.6 | 134.2 | 89.9 |
| document-layout/O1 | 358.4 | 150.2 | 79.7 |
| document-layout/O2 | 357.3 | 139.4 | 108.1 |
| symbolic-algebra/O0 | 317.3 | 98.6 | 60.0 |
| symbolic-algebra/O1 | 332.6 | 97.6 | 56.0 |
| symbolic-algebra/O2 | 883.0 | 162.1 | 138.3 |
| constraint-search/O0 | 242.8 | 94.0 | 35.5 |
| constraint-search/O1 | 359.5 | 114.6 | 33.2 |
| constraint-search/O2 | 308.9 | 114.2 | 42.3 |
| geometry-pipeline/O0 | 761.3 | 131.5 | 45.1 |
| geometry-pipeline/O1 | 411.8 | 147.5 | 43.0 |
| geometry-pipeline/O2 | 660.7 | 154.7 | 76.7 |

Times are single measurements. Worker peak includes diagnostic AST/disassembly extraction. API latency includes network transport and cannot establish comparative engine speed.
Structural counts and normalized-token similarities are in summary.json; they are lexical diagnostics and do not certify binding equivalence or readability. Full VM traces, bytecode, raw/final AST sources, disassembly and API bodies are preserved in evidence.tar.gz.
