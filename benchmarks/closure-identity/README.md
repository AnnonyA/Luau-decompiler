# Sealed closure identity regressions

`manifest.json` preserves the exact 66 v14 main profiles and 18 v9 single-load
controls from archive SHA-256
`3e9c1b4933db36741b39f9a756dc8b2d927cc30d90d82d09789302ee1759b324`.
The source is for inspection; originals execute from the locked bytes. The
controls pass 1,2,2,1 or change environments on one loaded chunk and compare
function keys, captured state and recursive self identity.

The default `complete-manifest.json` aggregates those original84, the 9 round1
holdout observations, 5 additional round1 observations, and separately grouped
round2 development regressions. It includes independent round2 profiles only
after their first observation against a frozen candidate has been retained.
A manifest observation is one input/protocol execution, so several observations
may share identical bytecode. The report distinguishes groups, versions and
requested/effective optimization; adding development inputs does not inflate a
historical corpus count.

Build official Luau `9d7748a4f324213a18cb8283fa2a77c330225fa0` with its Makefile
or CMake, then run:

```sh
npm ci
npm run build
npm run bench:closure-identity -- \
  --luau-source /absolute/path/to/luau \
  --luau-build /absolute/path/to/luau/build/release \
  --output /absolute/path/to/new-results
```

For CMake use the directory containing `luau-compile` and `libLuau.*.a`.
The script checks the official revision and tracked source state, builds the
required C++ hosts, verifies input SHA-256 and bytecode version, executes the raw
original, decompiles, recompiles the exact returned source, then executes those
bytes with the same host. A new output directory is required so later results
cannot overwrite the first independent observation. CI runs the same aggregate.
No API or network request is made.

The original version selects the compiler entry point: v9 uses the official C++
API's default feature flags, and v14 uses the official CLI's default flags.
Header `--!optimize` and `--!native` directives are retained. `compile-options.json`
records header comments, requested optimization and effective optimization using
the pinned official parser and Compiler.cpp's header/native rules. The emitted
bytecode version, type version and hash are measured separately. API v9 sources
with `--!optimize 2` therefore compile at effectiveO2 even for an original O0/O1
profile; they must preserve those original semantics despite that choice.

Hosts never reload between activations. Plain observations load once and invoke
once; repeated controls load once and invoke four times; the entry-environment
protocol changes the same chunk's environment A-B-A over three activations.
Independent scenario hosts document their activation and environment sequences
in their C++ source. All expected original traces remain unchanged.

Every profile retains exact source, both disassemblies, compiler metadata,
stdout, stderr, exit code, SHA-256 and command arguments. The result is MATCH only
when the trace matches the original, compilation succeeds and the emitted
version matches the profile. A divergence, compile error, timeout or unsupported
case fails the gate and stays visible in `results.json`.

To run the original84 or a specific preserved subgroup, use `--manifest`:

```sh
npm run bench:closure-identity -- \
  --manifest benchmarks/closure-identity/manifest.json \
  --luau-source /absolute/path/to/luau \
  --luau-build /absolute/path/to/luau/build/release \
  --output /absolute/path/to/new-original84-results
```

`bench:closure-identity:adversarial` still selects the9 original round1 holdout
observations. Their manifest retains the first candidate and original seal.
Historical failures are evidence and are not replaced by later successes.

## General semantic benchmark uses the same bytecode oracle

The source interpreter's default optimization can change function identity. The
semantic benchmark now runs exactly the compiled original bytes supplied to the
engine and the compiled recovered bytes. It requires an explicit official-VM
bytecode host, retains both byte sequences in the JSON report, and has no fallback
to recompiling the original source in an interpreter.

```sh
c++ -std=c++17 -O2 -I /absolute/path/to/luau/VM/include \
  scripts/closure-identity/run_bytecode.cpp \
  /absolute/path/to/luau/build/release/libluauvm.a \
  /absolute/path/to/luau/build/release/libluaucommon.a \
  -o /absolute/path/to/run-bytecode
npm run bench:semantic -- \
  --luau-compile /absolute/path/to/luau/build/release/luau-compile \
  --bytecode-runner /absolute/path/to/run-bytecode \
  --output /absolute/path/to/new-semantic-report.json
```

For CMake the library names are `libLuau.VM.a` and `libLuau.Common.a`.
Reports written before schema2 used source-interpreter execution and retain that
historical limitation. See `docs/references/closure-identity-review.md` for the
identity rules and pinned official/Tovek references. Cached Luacid receipts and
full independent observations accompany the review artifact.
