# Literal fidelity fixtures

These are project-authored programs compiled with official Luau
`9d7748a4f324213a18cb8283fa2a77c330225fa0`. `manifest.json` records the
SHA-256 of each original source and bytecode, compiler mode/flags, actual
version, optimization, host vector size and exact original observations.
The 12 original bytecode files were copied without recompilation from the
sealed first observations against engine
`e26040ae485b6e45eb7fa1b301903e3017c81fd7`. Historical failures stay in the
manifest; the runner does not exempt them from comparison.

| Cases | Compiler | Versions | Runtime |
| --- | --- | --- | --- |
| `integer64`, O0/O1/O2 | API defaults + `LuauIntegerType2` | 9 | VM3, `LuauIntegerLibrary=true` |
| `integer64`, O0/O1/O2 | CLI defaults + `LuauIntegerType2=true` | 14 | VM3, `LuauIntegerLibrary=true` |
| `vector-w`, O0/O1/O2 | API defaults | 9 | `LUA_VECTOR_SIZE=4`, `LUA_VECTOR_DOUBLE=0` |
| `vector-constructor-replaced`, O0/O1/O2 | API defaults, `vectorCtor="customVector"` | 9 | VM3; host installs native `customVector` before load |

All original compilations use debug level 2 and `vectorPrecision=0`. The
compiler alias in the last row is deliberately different from the replaced
global `vector.create`. At O2 the alias call becomes a vector constant and the
alias name is absent from the bytecode. Reconstructing a call to the replaced
global remains an execution divergence and emits
`vector-constructor-assumption`. Neither the warning nor a historical failure
changes the comparison result or exit code.

`integer64-boundaries.luau` is an additional parser/VM regression source,
covering zero, negative one, the first integer beyond exact double precision,
and both signed 64-bit limits. It is separate from the 12 sealed profiles.

## Reproduce

Start in the decompiler checkout. Set absolute paths; keep the build/output
directories outside the repository. Check out the official Luau pin above.

```sh
LUAU_SOURCE=/absolute/path/to/luau
LITERAL_BUILD=/absolute/path/to/literal-build
mkdir -p "$LITERAL_BUILD"
npm ci
npm run build
npm test -- tests/literal-value-fidelity.test.ts tests/printer-precedence.test.ts

make -C "$LUAU_SOURCE" config=release -j2 luau-compile build/release/libluauvm.a

c++ -std=c++17 -O2 \
  -I "$LUAU_SOURCE/Compiler/include" -I "$LUAU_SOURCE/Common/include" -I "$LUAU_SOURCE/Ast/include" \
  scripts/literal-fidelity/compile.cpp -Wl,--start-group \
  "$LUAU_SOURCE/build/release/libluaucompiler.a" "$LUAU_SOURCE/build/release/libluauast.a" \
  "$LUAU_SOURCE/build/release/libluaubytecode.a" "$LUAU_SOURCE/build/release/libluaucommon.a" \
  -Wl,--end-group -o "$LITERAL_BUILD/compile"

c++ -std=c++17 -O2 -I "$LUAU_SOURCE/VM/include" -I "$LUAU_SOURCE/Common/include" \
  scripts/literal-fidelity/run.cpp "$LUAU_SOURCE/build/release/libluauvm.a" \
  "$LUAU_SOURCE/build/release/libluaucommon.a" -o "$LITERAL_BUILD/vm"

make -C "$LUAU_SOURCE" config=release BUILD="$LITERAL_BUILD/vector4" \
  'CXXFLAGS=-std=c++17 -O2 -DNDEBUG -fno-math-errno -DLUA_VECTOR_SIZE=4 -ICommon/include -IVM/include' \
  -j2 "$LITERAL_BUILD/vector4/libluauvm.a" "$LITERAL_BUILD/vector4/libluaucommon.a"
c++ -std=c++17 -O2 -DLUA_VECTOR_SIZE=4 \
  -I "$LUAU_SOURCE/VM/include" -I "$LUAU_SOURCE/Common/include" \
  scripts/literal-fidelity/run.cpp "$LITERAL_BUILD/vector4/libluauvm.a" \
  "$LITERAL_BUILD/vector4/libluaucommon.a" -o "$LITERAL_BUILD/vm4"

node scripts/bench-literal-fidelity.mjs \
  --luau-root "$LUAU_SOURCE" --api-compiler "$LITERAL_BUILD/compile" \
  --vm "$LITERAL_BUILD/vm" --vm4 "$LITERAL_BUILD/vm4" \
  --out "$LITERAL_BUILD/results"
```

The output directory must be new. The runner verifies all input bytecode hashes,
runs the exact original bytes, verifies their recorded observations, saves the
exact returned source, recompiles it with the original compiler mode/options,
and records stdout, stderr and exit code for both runs. It exits **1** for the
remaining constructor divergence. To run only the corrected profiles, add
`--cases integer64,vector-w` with a different output directory; those nine
profiles exit **0**. No samples are sent to services.

The additional boundaries source can be checked at each optimization with the
same helpers. Save the exact source returned by the API:

```sh
for literal_level in 0 1 2; do
  "$LITERAL_BUILD/compile" tests/fixtures/literal-fidelity/integer64-boundaries.luau \
    "$literal_level" "$LITERAL_BUILD/boundary-original.luac" integer
  node --input-type=module -e 'import {readFileSync,writeFileSync} from "node:fs"; import {decompile} from "./dist/decompile.js"; const r=decompile(readFileSync(process.argv[1]),{opcodeEncoding:"official",runtimeContext:false}); if(!r.ok)throw Error(r.error); writeFileSync(process.argv[2],r.source);' \
    "$LITERAL_BUILD/boundary-original.luac" "$LITERAL_BUILD/boundary-recovered.luau"
  "$LITERAL_BUILD/compile" "$LITERAL_BUILD/boundary-recovered.luau" \
    "$literal_level" "$LITERAL_BUILD/boundary-recovered.luac" integer
  "$LITERAL_BUILD/vm" "$LITERAL_BUILD/boundary-original.luac"
  "$LITERAL_BUILD/vm" "$LITERAL_BUILD/boundary-recovered.luac"
done
```

Each pair prints the integer type and decimal values `0`, `-1`,
`9007199254740993`, `9223372036854775807`, `-9223372036854775808`.
