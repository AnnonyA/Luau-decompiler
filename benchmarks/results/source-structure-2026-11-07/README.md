# Structured source with preserved evaluation order

Baseline: `069de7dd36a2fa32bd3d372c424a14c5bdb3983b` (PR #70).
Official Luau: `9d7748a4f324213a18cb8283fa2a77c330225fa0`.
No external API requests. Existing sources, bytecode and competitor responses
remain unchanged.

Function-tail return guards can now release their redundant else scope. Adjacent
single-use return temporaries preserve single-result adjustment for calls and
varargs. Private method receivers become chains without crossing argument effects.
Owned child tables can join their parent constructors when local dependencies are
immutable and unshadowed; assignment/call receivers retain their bindings.
Nested records print across lines and top-level sections gain whitespace without
reordering initialization.

Review exposed a scope hazard in the shared block mapper: repeat-body cleanup
did not see references and captures in the until condition. All mapped cleanup
passes now analyze that condition in the body's lexical scope and carry renames
back into it. Four focused tests cover direct and closure condition references.

Three project-authored programs are permanent development regressions:

| Program | O0 | O1 | O2 | Inputs per profile |
| --- | --- | --- | --- | --- |
| layout-evaluation-order | MATCH | MATCH | MATCH | 3 |
| layout-scopes-tables | MATCH | MATCH | MATCH | 3 |
| layout-repeat-scopes | MATCH | MATCH | MATCH | 3 |

They check receiver/argument/metamethod order, clipped multiple returns, varargs,
table alias identity, mutated and shadowed dependencies, guard captures, and
repeat-condition scope. `focused.json.gz` contains the nine default profiles;
the full reports also exercise naming styles and rewrite switches.

The supplied private IndexUI output has 367 local declaration lines instead of
391, and 62 standalone else lines instead of 81. Its complete output passes the
official parser. Full Roblox runtime equivalence is **not measured**. Neither
the uploaded bytecode nor competitor source is committed or transmitted. Some
helper duplication and original module organization remain unrecovered; these
metrics do not establish competitive semantic superiority.

Validation:

- 612 unit tests, typecheck/build, 50 benchmark harness tests.
- 6 demo tests and 1 real Chromium test.
- 4182/4182 rewrite profiles (7803 input comparisons).
- 1230/1230 naming profiles (2295 input comparisons).
- Existing 200/200, 24/24, 36/36, pilot 15/15, cohort 2 15/15,
  independent regressions 9/9 and generated profiles 18/18.
- Tovek: 47/47 decode and official-parser checks, not 47 semantic matches.

Tovek V2.7 reference: `a70720174f61028af9e38e8f6761d18c422c0bc7`.
Implementation is independent; see the reference notes for the bounded invariants
consulted. The benchmark corpus stays pinned to
`77edf387bf280a2f4d46d57ac85d5c4f071b763f`.

Compressed reports preserve parser results, VM observations and hashes.
`summary.json` hashes the compressed report files. Reproduce with
`bench:large:regressions --rewrite-options` or `--name-styles`, supplying the
pinned `--luau-compile`, `--luau` and an `--output` directory as in CI.
