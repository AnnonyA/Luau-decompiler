# Luau Decompiler — Competitive Roadmap

> **Status:** planning document, recorded 2026-10-19. The shipped package version is currently **0.2.0**. Milestones below are **not released or completed** merely because they appear here. Each future release requires the stated acceptance checks and an explicit version bump.
>
> **Goal:** build a demonstrably better Luau decompiler than [LunaUX-Decompiler](https://github.com/boydev-1444/lunaux-decompiler), prioritizing actual semantic preservation over plausible-looking output, while retaining a local/offline, auditable TypeScript implementation.

## Baseline, sources and fair comparison

- **Our project (0.2.0):** local TypeScript engine, bytecode decode → CFG → SSA → AST → Luau printer, CLI (`decompile`, `disassemble`, `info`, `serve`), local HTTP/web frontend, explicit diagnostics, broad v3–9 coverage and experimental v10–14 support. Three real bytecode fixtures have dedicated source-pattern tests, but their passing tests are **not** a semantic-fidelity percentage.
- **LunaUX (reported v1.4.3 on 2026-10-19):** publicly documents decompilation, disassembly, CFG viewing, native offline downloads, a web demo and API, many formatting/reconstruction toggles, and a published set of **22** bytecode samples alongside its output. Its proprietary/hosted engine and the fact its tests pass there do not prove how it performs on an independent comparison.
- References: [LunaUX README](https://github.com/boydev-1444/lunaux-decompiler/blob/main/README.md), [documentation](https://lunaux-decompiler.dev/documentation), [public fixtures](https://github.com/boydev-1444/lunaux-decompiler/tree/main/Tests), [our README](README.md).
- Do **not** claim superiority from release numbers, GitHub stars, a single fixture, or a successful TypeScript test run. Obtain fresh measurements and record their dates and versions.

### Benchmark protocol (from v0.3.0 onward)

1. Keep **all 22 public LunaUX binary fixtures** as a *shared visible comparison*, with hashes, attribution and licenses recorded. Use source/output references only as diagnostic samples, **not** the ground-truth semantics. Do not copy competitor implementation.
2. Maintain an additional locked **200+ independently sourced samples**, with controlled, license-permitted synthetic and real-world Luau cases. Reserve the holdout from optimization; publish manifests and instructions when licensing permits. Cover branches, loops, captures, tables, multi-return, edge-case numerics and bytecode versions.
3. Record, independently for each decompiler and each fixture: decode success, syntactically valid output checked with the **official Luau compiler**, captured semantics on deterministic *project-owned* execution tests, missing statements/side effects, anonymous register leakage, source readability, total time and peak memory.
4. Run the same input, compiler/opcode profile and options whenever possible. For speed use both competitors' *offline engine or CLI* on the **same machine**; do not compare local compute time with remote API latency. Report unsupported format/feature cases separately and never replace them with fabricated scores.
5. Every release includes an automated regression suite, TypeScript typecheck, build and passing GitHub CI on Node 20 and 22. Relevant syntax/semantic differential tests must also pass. Preserve a clear unsupported-bytecode error rather than inventing behavior.
6. Publish `benchmarks/results/<date>-<version>.json` or an equivalent reproducible report containing per-fixture results, engine versions, settings, hashes and platform details. Until measured, mark values **NOT MEASURED**.

## Numbered release plan

### 1. v0.3.0 — Reproducible head-to-head baseline
Build `bench:compare` and a corpus manifest; collect LunaUX's public 22 binary examples with provenance (or fetch by pinned hashes where appropriate); add a set of independent fixtures and official `luau-compile` syntax checks. Distinguish syntactic, static-semantic and executable differential checks.
- **Done when:** one command generates reproducible per-file JSON/Markdown reports and runs on at least the 22 shared cases; no superiority claims without measured data.

### 2. v0.4.0 — Luau printing and lexical fidelity
Fix expression precedence/associativity, unary/binary operator spacing, safe parenthesization, interpolation escaping, arbitrary string keys and valid function-call syntax. Add cross-product and property tests with the official parser.
- **Done when:** the compiler accepts every successfully emitted sample in the current controlled corpus, with no new side-effect or scoping regressions.

### 3. v0.5.0 — SSA, phi and temporary elimination
Refine register lifetime tracking, phi placement at `if/elseif/else` joins, live ranges and dominator-based elimination of generated locals. Only inline across blocks when proven safe for aliasing, mutation and side effects.
- **Done when:** dedicated diamond/loop-carried-value tests prove identical observable behavior and fewer artificial locals than the v0.3.0 baseline.

### 4. v0.6.0 — Structured CFG and complex branches
Recover nested and sequential `if/elseif` regions, `while`, `repeat/until`, numeric and generic `for`, `continue`/multi-backedge loops, guard clauses and irreducible fallbacks.
- **Done when:** the original branch/loop semantics are preserved for each covered CFG shape and no reachable block is duplicated or dropped.

### 5. v0.7.0 — Closures, recursion and upvalues
Handle recursive and mutually recursive functions, `NEWCLOSURE`/`DUPCLOSURE`, capture-by-reference/value/upvalue, shadowed locals and closure value lifetime without inventing aliases.
- **Done when:** nested-closure and reference-mutation tests agree with controlled originals, including closures stored or returned from tables and branches.

### 6. v0.8.0 — Tables, calls, varargs and multiple returns
Recover `DUPTABLE`/`NEWTABLE`, table writes, metamethod-sensitive evaluation order, method calls, `SETLIST`, `GETVARARGS`, `CALL`/`RETURN` open packs and `FASTCALL` fallback semantics.
- **Done when:** ordered evaluation and value-count tests pass, with no dropped field writes, duplicate calls or invented extra return values.

### 7. v0.9.0 — Modern bytecode compatibility
Complete a documented and verified opcode/profile matrix, particularly experimental v10–14; exercise `FASTPCALL`, `AUX`, debug/type/feedback metadata and Roblox opcode remapping with official/upstream evidence.
- **Done when:** every claimed supported version has real or compiler-generated fixtures, and unknown versions/opcodes receive precise errors. Do not call an unverified version fully supported.

### 8. v1.0.0 — Stable semantic core
Harden input bounds, malformed files, nested prototype graphs, deterministic output and errors; freeze the public library/CLI behavior and make syntax + semantic regression gates blocking.
- **Done when:** broad v3–9 compatibility is reproducible, all known critical fidelity bugs are fixed, and release criteria are backed by published reports (not assumed percentages).

### 9. v1.1.0 — Naming and conservative types
Improve names from debug info, method context, service calls and scoped SSA roles; infer function/return types only with strong evidence, and expose opt-in annotations.
- **Done when:** a blinded comparison of outputs reports fewer `rN`/`valueN` placeholders and fewer false type annotations, with zero semantic regression.

### 10. v1.2.0 — Feature and option parity
Expose independently implemented options for `continue` style, guard compactness, loop sugaring, interpolation, debug/capture annotations and optimization levels; supply stable decompile/disassemble/CFG endpoints and structured diagnostics.
- **Done when:** documented CLI, local server and library APIs implement and test the promised controls; feature parity is explicit rather than presumed.

### 11. v1.3.0 — Developer workflows and model support
Improve local web UX and CFG visualization, file upload and batch mode; add licensed, defensive parsers/extractors for `.rbxm`, `.rbxmx`, `.rbxl` as separate optional stages when feasible.
- **Done when:** every advertised file format is covered by legitimate fixtures, error handling and bounded-memory/security tests; bytecode decompilation remains usable fully offline.

### 12. v1.4.0 — Scale, performance and reliability
Profile decode/CFG/SSA/printer hotspots on varied input sizes, set resource ceilings and fix pathological quadratic scans, handle larger scripts with deterministic memory and fault isolation.
- **Done when:** p50/p95 latency, peak memory and success/error rates are measured on the same pinned corpus and machine and meet published performance budgets.

### 13. v1.5.0 — Verified competitive superiority candidate
Freeze a fair comparison against the **latest available LunaUX** (not merely historical v1.4.3), execute both engines on the shared 22 fixtures and the independent locked 200+ holdout, publish reproducible per-sample output and performance methodology. Fix remaining gaps first.
- **Declare a win only if:** our recovered Luau is syntactically valid in at least **99%** of mutually supported holdout files; it has **a higher demonstrated semantic-equivalence rate** than LunaUX on the holdout (target margin **at least 3 percentage points**); there are **no major regressions** in CFG/captures/multret categories; critical workflows are available locally/offline; and latency/memory limitations are transparently reported. If these gates are not met, keep iterating and do **not** declare victory or ship the superiority label.

## Execution rules

- Pick the **first unfinished milestone** and its highest-value failing test, not arbitrary version bumps or cosmetic changes.
- Each engineering PR should add a minimal regression test first, include root-cause explanation and preserve side effects/scope. CI on Node 20/22 must pass before squash merge.
- Do **not** bump `package.json` merely for the roadmap. Increment a version only after that milestone's evidence is collected; publish release notes for each milestone.
- Benchmark results are observations, not promises. LunaUX might change; recheck the competitor at comparison time.
- Follow license requirements for imported fixtures; never copy proprietary implementation code or automate abusive calls to third-party services.
- In every progress report, identify the current target version, completed acceptance criteria, blocked criteria, last merged PR and the next candidate improvement.
- The hourly improvement task, when enabled, should read this file before deciding which change to make.
