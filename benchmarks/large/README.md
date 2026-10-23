# Large original Luau systems

Five-program pilot; **not yet the requested 50-program corpus**. The development systems have three different architectures: a transactional store, a dependency scheduler, and a framed protocol router. Two independently authored architectures (query planner and reactive simulation) were reserved before engine tuning. All sources are project-authored. No private or third-party sources were submitted to APIs.

The programs combine a handwritten runtime with generated, specialized domain handlers. Repeated templates within a system are **not independent programs**. `significantLines` is a conservative physical-line count excluding blank lines, comments and standalone control delimiters, not an AST complexity metric. The five programs contain 1,072–1,429 such lines each. This pilot does not establish scalability at 5,000 lines or over 50 independent systems.

`manifest.json` seals source hashes, partitions and twelve deterministic seed/mode pairs. `bytecode-sha256.json` seals all fifteen official O0/O1/O2 compilations at `-g1`. The runner rejects changed sources or compiled bytes. Generators in `scripts/large/` document provenance; do not regenerate or reseal existing references to accommodate failures. New cohorts need new manifests.

Use official Luau revision `9d7748a4f324213a18cb8283fa2a77c330225fa0`:

```sh
npm ci
npm run build
npm run bench:large -- --luau-compile /path/luau-compile --luau /path/luau \
  --output /tmp/large-development --cache /path/api-cache --require-local-match
npm run bench:large -- --luau-compile /path/luau-compile --luau /path/luau \
  --output /tmp/large-holdout --cache /path/api-cache --partition observed --require-local-match
npm run bench:large:regressions -- --luau-compile /path/luau-compile --luau /path/luau \
  --output /tmp/large-regressions
```

External requests default to disabled and a zero budget. Only an explicit `--external --max-requests N` permits cache misses; the pilot ceiling is 30. Both adapters receive the same bytes. Cache keys include the exact endpoint/body; response hashes are checked. The client serializes requests at ≥1.25 seconds apart, limits responses to 2 MiB and timeouts to 20 seconds, and opens a circuit on authorization/rate/server failures. No automatic retry is performed. Lua.Expert documented 500 requests/minute when checked on 2026-10-22; LunaUX did not publish a numeric rate in the retrieved documentation. Consult current terms before a new cohort. This pilot used 30 new requests total; old competition responses were never resent.

Local decoding runs in a disposable process with a 512 MiB V8 heap limit and a 30-second timeout. The heap limit is **not** a total process-memory ceiling. Official parser/runtime processes have separate timeouts. Only owned fixtures are executed. Reports retain peak worker RSS, decompile time, syntax, VM traces, raw reconstruction, final AST, disassembly, compiler hashes and full external response records. API latency and local elapsed time are different measurements and cannot establish relative throughput.

Only the first reserved-corpus run is a blind evaluation of this cohort. Later CI runs are regressions, not fresh holdout evidence. Preserve the first engine freeze and results. MATCH requires every tested input to match; lexical structure/token metrics are secondary and do not prove scope equivalence or readability. The first pilot now passes 15/15 after development on the observed query-planner and reactive-simulation cases. They are development regressions, not blind evidence. Expansion toward 50 systems continues in separately sealed cohorts.

See [first measurements](../results/large-2026-10-22/README.md) and [15/15 follow-up](../results/large-2026-10-23/README.md). New cohorts use `--manifest <cohort>/manifest.json`; their first evaluation also requires a recorded `--freeze`.
