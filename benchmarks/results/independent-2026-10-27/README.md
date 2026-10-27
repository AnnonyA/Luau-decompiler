# Independent architecture comparison, 2026-10-27

Three newly authored systems (759 source lines total), each compiled at O0/O1/O2,
24 deterministic input pairs per profile: 9 profiles and 216 input runs per engine.
These are compact architecture probes, not an expansion to 50 large systems.
Sources and exact official bytecode were sealed before the first measurement.
The authors saw their own sources; they were not drawn from the prior corpus.

| System | AnnonyA first | LunaUX first | Lua.Expert first | AnnonyA after fix |
|---|---:|---:|---:|---:|
| Entity store | 3/3 | 3/3 | 3/3 | 3/3 |
| Incremental workbook | 1/3 | 3/3 | 3/3 | 3/3 |
| Streaming audio | 3/3 | 2/3 | 3/3 | 3/3 |
| Total semantic MATCH | **7/9** | **8/9** | **9/9** | **9/9** |

The workbook's O1/O2 closures read the final loop score instead of the score at
creation time. VAL capture emission now snapshots reused SSA phi cells without
changing REF capture ownership. Once used to develop that fix, the workbook
became a development regression; the after-fix 9/9 is not a blind result.
The other two systems were not used to tune the engine during this evaluation.

The first and final JSON reports and compressed evidence are retained separately.
There were 18 external requests in the first run; later runs used those cached
responses, with zero additional requests. Bytecode hashes match across engines.
The official parser and runtime validate every MATCH; structural counts and
normalized similarity are lexical proxies, not proof of recovered source identity.
HTTP and local timings are recorded but are not comparable throughput measures.

Reproduce after building:

```bash
npm run bench:independent -- --luau-compile /path/to/luau-compile \
  --luau /path/to/luau --output /tmp/independent-results --cache /path/to/api-cache
```

External access is opt-in (`--external`); the cap is 18 requests, with timeouts,
rate spacing and a circuit breaker. Existing response artifacts can be inspected
without any network access. Recompilation must reproduce the sealed bytecode.

Additional validation of the integrated engine: 424 unit tests, 44 harness tests,
200/200 original semantic comparisons, 24/24 original competition profiles,
36/36 scope/CFG regressions, 30/30 large-system profiles, 525/525 reduced profiles
across five naming modes, and 90/90 seeded profiles (30 generated programs).
Chromium covers the naming controls and existing upload/copy/download flows.
Generated programs share a grammar and are not 30 independent architectures.

No universal accuracy or superiority over both engines is claimed. The new
independent first measurement favors Lua.Expert; our corrected engine matches it
on the observed corpus and exceeds LunaUX's measured semantic count here.
