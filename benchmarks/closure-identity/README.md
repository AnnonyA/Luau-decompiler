# Sealed closure-identity regression corpus

`manifest.json` locks the exact 66 v14 main profiles and 18 v9 single-load
controls from archive SHA-256
`3e9c1b4933db36741b39f9a756dc8b2d927cc30d90d82d09789302ee1759b324`.
The accompanying source is for inspection; originals are always executed from
the locked bytes. The controls pass 1,2,2,1 or change environments on one loaded
chunk and compare function keys, captured state and recursive self identity.

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

For CMake use the build directory containing `luau-compile` and `libLuau.*.a`.
The script checks the official revision, compiles the three C++ runners, hashes
each original, decompiles, recompiles with the matching compiler entry point,
and compares stdout/stderr/exit. It preserves all traces and commands. No API
or network request is made. The CI gate runs these same 84 profiles.

The two independent holdouts are now development regressions. Their manifest
retains the first frozen-candidate identifier and original source/bytecode seal.
Run them explicitly with the same flags:

```sh
npm run bench:closure-identity:adversarial -- \
  --luau-source /absolute/path/to/luau \
  --luau-build /absolute/path/to/luau/build/release \
  --output /absolute/path/to/new-adversarial-results
```

This command currently reports the remaining h01/O2 divergence and exits 1.
It keeps that failure visible instead of weakening its original assertions.
See `docs/references/closure-identity-review.md` for proof boundaries and exact
official/Tovek references. Full Luacid receipts, the immutable first independent
observations and before/after phase traces are in the accompanying review ZIP.
