# Large original systems: measured comparison

Each profile uses 12 deterministic inputs. MATCH means the official VM produced identical observable traces on those inputs, not universal equivalence.
Partition labels record evaluation provenance. Development and development-regression cases informed fixes; only a first frozen holdout run is blind evidence. Do not pool tuned results as a blind generalization score.

| Program | Partition | O | AnnonyA before | AnnonyA after | LunaUX | Lua.Expert |
|---|---|---:|---|---|---|---|
| archive-filesystem | development | 0 | MATCH | MATCH | MATCH | MATCH |
| archive-filesystem | development | 1 | MATCH | MATCH | MATCH | MATCH |
| archive-filesystem | development | 2 | MATCH | MATCH | MISMATCH | MATCH |
| document-layout | development | 0 | MATCH | MATCH | MATCH | MATCH |
| document-layout | development | 1 | MATCH | MATCH | MATCH | MATCH |
| document-layout | development | 2 | MATCH | MATCH | MATCH | MATCH |
| symbolic-algebra | development | 0 | MATCH | MATCH | MISMATCH | MATCH |
| symbolic-algebra | development | 1 | MATCH | MATCH | MISMATCH | MATCH |
| symbolic-algebra | development | 2 | MATCH | MATCH | MISMATCH | MATCH |
| constraint-search | development-regression | 0 | MISMATCH | MATCH | MATCH | MATCH |
| constraint-search | development-regression | 1 | INVALID | MATCH | MATCH | MATCH |
| constraint-search | development-regression | 2 | INVALID | MATCH | MISMATCH | MATCH |
| geometry-pipeline | development-regression | 0 | MISMATCH | MATCH | MATCH | MATCH |
| geometry-pipeline | development-regression | 1 | MISMATCH | MATCH | MATCH | MATCH |
| geometry-pipeline | development-regression | 2 | MISMATCH | MATCH | MATCH | MATCH |

| Engine | Matching profiles | Matching input runs |
|---|---:|---:|
| annony | 15/15 | 180/180 |
| lunaux | 10/15 | 120/180 |
| luaexpert | 15/15 | 180/180 |

| Program/O | Local decompile ms | Worker peak MiB | Bytecode KiB |
|---|---:|---:|---:|
| archive-filesystem/O0 | 377.3 | 98.5 | 54.9 |
| archive-filesystem/O1 | 354.2 | 107.2 | 52.7 |
| archive-filesystem/O2 | 367.8 | 128.2 | 77.6 |
| document-layout/O0 | 412.5 | 145.0 | 89.9 |
| document-layout/O1 | 357.6 | 138.8 | 79.7 |
| document-layout/O2 | 374.7 | 145.4 | 108.1 |
| symbolic-algebra/O0 | 335.8 | 98.2 | 60.0 |
| symbolic-algebra/O1 | 306.1 | 95.7 | 56.0 |
| symbolic-algebra/O2 | 880.9 | 162.5 | 138.3 |
| constraint-search/O0 | 280.7 | 91.0 | 35.5 |
| constraint-search/O1 | 228.4 | 96.3 | 33.2 |
| constraint-search/O2 | 328.3 | 103.2 | 42.3 |
| geometry-pipeline/O0 | 458.5 | 135.5 | 45.1 |
| geometry-pipeline/O1 | 519.5 | 141.1 | 43.0 |
| geometry-pipeline/O2 | 653.3 | 151.0 | 76.7 |

Times are single measurements. Worker peak includes diagnostic AST/disassembly extraction. API latency includes network transport and cannot establish comparative engine speed.
Structural counts and normalized-token similarities are in summary.json; they are lexical diagnostics and do not certify binding equivalence or readability. Full VM traces, bytecode, raw/final AST sources, disassembly and API bodies are preserved in evidence.tar.gz.
