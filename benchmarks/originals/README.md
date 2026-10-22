# Original-source comparison: AnnonyA, LunaUX, Lua.Expert

These 12 independently authored programs are new; none was copied from the
100-program regression corpus or competitor sources. `manifest.json` supplies
three CLI inputs (`-2`, `0`, `3`) to each original. The programs combine features
rather than duplicate small expressions:

| Program | Principal observations |
|---|---|
| ledger | Mutable upvalues, snapshots, conditionals, accepted/rejected writes |
| dispatch | Nested loops, continue/break, repeated compound exit conditions |
| recursive-parser | Recursive closure, cursor mutation, parse return values |
| pack-pipeline | Varargs, nil holes, open/fixed multiple results, argument order |
| matrix-scope | Per-iteration captures, table aliases, nested generic loops |
| rollback | Protected closure errors, table writes and rollback, conditional returns |
| codec | Binary/Unicode strings, formatting, iterator state, byte checksum |
| graph-walk | Nested tables, recursive DFS, visited set and ordered trace |
| iterator-state | Custom iterator/state/control triple, generator effects |
| branch-phis | Multi-variable joins, nested branches, loop-carried values |
| shadowed-constants | Exact floating constants, local math shadowing, real global lookup |
| effect-schedule | Call/read/key/value order, snapshots and mutation |

## Run

Build the pinned official compiler/runtime at
`9d7748a4f324213a18cb8283fa2a77c330225fa0`, as in [the benchmark guide](../README.md).
Then:

```sh
npm ci
npm run build
npm run bench:competition -- \
  --luau-compile /absolute/path/luau-compile \
  --luau /absolute/path/luau \
  --output /tmp/competition \
  --cache /tmp/competition-cache \
  --external
```

Only `--external` permits requests. Omit it to replay cached responses and rerun
the local engine; CI always runs offline. `--require-local-match` exits nonzero
when any new local comparison fails, including a missing measurement. The new
CI gate deliberately remains red while known local failures remain.

For the recorded responses, extract
`../results/competition-2026-10-21/evidence.tar.gz` into an empty directory and
pass its `api-cache` directory to `--cache`. This needs zero new API requests.
The archive also contains original sources, exact bytecode, three reconstructions,
request/response JSON, disassembly, and before/after traces. Historical results
are in [the short report](../results/competition-2026-10-21/README.md).

Each original is compiled once per profile (`-O0 -g1`, `-O1 -g1`), then that exact
buffer is given to all three engines. SHA-256 hashes allow verification. Sources
are parsed with `--only-parse` and run in the official CLI with each input and
the corresponding optimization level. Output comparison is byte-for-byte,
including stdout/stderr and execution success; traces are Base64 in JSON.
Compilation is limited to 15 seconds, execution to 3 seconds and 1 MiB output.
This is a fixed allowlist, not a runner for arbitrary third-party scripts.

## API contract and traffic

Contracts inspected on 2026-10-21:

- [LunaUX documentation](https://lunaux-decompiler.dev/documentation): no key,
  `POST https://lunaux-decompiler.dev/api/decompile`, JSON `bytecode` in Base64,
  `options: {}` (service defaults); success is plain-text Luau.
- [Lua.Expert documentation](https://lua.expert/docs):
  `POST https://api.lua.expert/v1/decompile`, JSON `script` in Base64; success is
  plain-text Luau. Published limit: 500 requests/minute.

The client sends requests sequentially, at least 1.25 seconds apart, with a
20-second timeout and 2 MiB response cap. It sends at most 48 requests per run
(`--max-requests 0..48`), without retries. Auth, rate-limit, server and network
failures stop further requests to that service. Cached failures are retained;
inspect them and use a new cache directory for an intentional later retry.
The cache key includes endpoint and the complete request body/options; cached
response hashes are verified. Responses retain raw bytes, HTTP status, selected
headers, measured time and errors. No tokens/cookies are used or recorded.
Only our authored compiled programs are submitted; no compiler/service source
implementation is copied.

## Meaning of results

- **MATCH**: all three tested inputs have equal observable traces and succeed.
- **MISMATCH**: recovered source parses but errors, times out or differs on an input.
- **INVALID**: the official parser rejects recovered source.
- **UNSUPPORTED**: explicit unsupported bytecode/version response.
- **NO MEDIDO**: missing response, disabled requests, protocol/auth/transport error,
  incomplete input matrix or invalid original reference.

Semantic traces take precedence. JSON additionally records lexical counts of
control structures/functions/returns/locals, assignments, generated names and
code size, plus identifier-normalized token-trigram similarity. These are
heuristics, not AST correspondence, static binding proofs or a readability score.
Interpolation bodies are opaque to the lexical scanner. Trace checks exercise
scope/capture and side-effect behavior on selected inputs; they cannot establish
absence of every possible lost effect. Equivalent restructuring may legitimately
change these counts. No combined score claims otherwise.

The 12 programs became development regressions once used to guide corrections.
They are not a holdout, exhaustive evaluation or a universal ranking. HTTP times
include transport and cannot be directly ranked against local decompilation time.
