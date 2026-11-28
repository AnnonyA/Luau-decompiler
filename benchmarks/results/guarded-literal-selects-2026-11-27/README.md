# Scalar values with a literal default

A private local initialized to an inert literal followed by one guarded store
can be reconstructed as one scalar conditional expression. For example:

```luau
local result = false
if entry ~= nil then result = entry.ready ~= nil end
return result
```

becomes `return entry ~= nil and entry.ready ~= nil`. The guard and selected
value keep their evaluation order. Unknown truthiness tests retain an explicit
`if` expression, so a nil test still returns the original false default.
NaN-sensitive ordering comparisons keep their explicit negation.

## Admission and limits

The declaration has exactly one local and one literal initializer; the
immediately following guard has one assignment to that same local and no
alternate branch. Neither the condition nor the selected value may read that
local. Captured cells, closure literals, open varargs, effectful defaults,
parallel assignments and multi-statement branches are retained. The existing
`ifExpressions` option controls this recovery. No source/case names, expected
answers or benchmark input files are consulted by the engine.

This is an independent TypeScript implementation. References inspected:

- Tovek `ce2ea3325547fa3896f274b68013386338039040`,
  `ast/src/compact_conditionals.rs`, especially `select_value`, `arm_value`
  and its capture-safety checks; MIT license, Jujhar Singh and Mathias
  Pedersen (2024). No source code was copied.
- Official Luau `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`,
  `Compiler/src/Compiler.cpp`, `compileExprIfElse` and `compileStatLocal`:
  the selected expression is evaluated into the reserved local result slot,
  with exactly one value and only the chosen arm evaluated.

## Measured diagnostic

The fixed 882-profile cache, default options and unchanged Rosetta scorer give:

| Measurement | Baseline `fc6e10a` engine | Candidate |
| --- | ---: | ---: |
| Source similarity | 77.49586128999316% | 77.52962061066746% |
| Normalized token ratio | 0.9820264838255064 | 0.9812874738412655 |
| Profiles with higher/equal/lower similarity | — | 90 / 792 / 0 |
| Decompilation failures | 0 | 0 |

The gain is **0.03375932067431 percentage points**. This is a source-quality
replay, not a strict behavioral benchmark result. The combined engine must
pass the separate unchanged Quick gate before publication. The
[summary](quality-summary.json) preserves identities and all 90 changed scores.
The 100% target is not reached.

## Independent native controls

Two project-authored fixtures are sealed in
`tests/fixtures/guarded-literal-selects/manifest.json`. Both official pins
(`9d7748a4f324213a18cb8283fa2a77c330225fa0` and `c87565b8...`) compile each
fixture at O0/O1/O2 with g1/g2, giving **24 profile checks**. Baseline and
candidate both match **24/24**, comparing exact stdout, stderr and exit status
from original bytecode versus recompiled output on the matching native VM.

Controls cover lazy producer effects, zero/nil-bearing/multiple returns,
false versus nil defaults, NaN, comparison and index metamethods, aliases of
returned tables/functions, captured cell writes, closure identity as table
keys, lexical shadows, effectful initializers and observable function names.
Their unchanged first results are in `baseline-native.json.gz` and
`candidate-native.json.gz`. These are development controls, not new held-out
benchmark programs. The executable reproduction script accepts an engine
distribution and a new output directory:

```sh
python benchmarks/results/guarded-literal-selects-2026-11-27/reproduce-native.py \
  --dist /absolute/engine/dist --out /absolute/new-native-results
```

`--references` selects the reference-workspace root containing the two pinned
compiler checkouts and the native bytecode hosts; `--node` selects Node.js.
All fixture inputs and sources are verified against their sealed hashes before
execution. Runtime artifact paths and exact compiler/host hashes are retained
in the receipts.
