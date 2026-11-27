# Temporary provenance checkpoint — 2026-11-27

This checkpoint is based on `521284f` (parallel declaration provenance), on top
of `dc4d32d`. It adds prototype-owned declaration evidence, scalar list-tail
folding with arity preserved, and a correction for an unused but effectful guard
prelude that reused a boolean-result register.

## Results

| Gate | Before this change | Candidate |
| --- | ---: | ---: |
| Rosetta Quick behavior | 882/882 | 882/882 |
| Quick similarity | 72.34928020667942% | 72.58124611254142% |
| Quick token-size ratio | 1.1005605792605317× | 1.0973765605214243× |
| Quick local-count ratio | 1.1211887363775512× | 1.1064897783442593× |
| Rosetta HardQuick behavior | 882/882 | 882/882 |
| HardQuick similarity | 71.84626804522347% | 71.91605075777282% |
| HardQuick token-size ratio | 1.1079835785560854× | 1.106727351002097× |
| HardQuick local-count ratio | 1.117143542431954× | 1.1109838137856827× |
| Authored behavior, 4 sources × 12 profiles | 44/48 | 48/48 |
| Unit suite | 1,330 | 1,360 passed, 0 failed |

The previous tier metrics are in `../debug-declarations-2026-11-27/`.
Each candidate tier has all 882 quality round trips and unchanged suite/profile
counts. Names are a separate diagnostic: Quick changes from 60.83699151302312%
to 60.83113842551946%, and HardQuick from 29.96780801872988% to
29.96488147497805%. Removing an incidental generated spelling need not improve
that spelling-based metric. No score, verdict, suite, compiler input or
benchmark source was modified. These are raw pinned Rosetta measurements;
Myers has its upstream time limit, so large-case score timing remains a limit
of the metric.

On the 44 authored profiles that both engines pass, similarity increases from
73.786414753307% to 74.06279729171233%, and size changes from
1.5004128519433755× to 1.4946594363575147×.

## Preserved independent failures

The first run covered three newly authored sources: both engines passed 32/36.
All four failures were the O2 variants of `debug-collision-order`. Its exact
original bytecode contains an unused `GETTABLEKS` whose metamethod must still
run. Both the prior engine and the initial candidate omitted that read while
recovering a later boolean selection that reused its destination register.

`initial-authored.json` and its unchanged log retain that first result.
`first-failure/{before,after}` retains the exact O2g2 input, output, expected
trace, actual trace and difference. The final runtime report includes the
additional prototype-parameter control and passes all 48 candidate profiles;
the frozen previous engine still fails those same four optimized profiles.
The original failing source and bytecodes were never rewritten.

Two development unit logs are also retained: extending list-tail folding to
AST declarations with unknown provenance changed two existing structure
contracts; producer ownership now bounds that extension. A later authored
parameter-collision assertion exposed that register-inferred name hints needed
the same prototype ownership as debug hints. The final focused and full logs
pass without changing the pre-existing assertions.

## Reproduction and scope

The compiler is Luau 0.747 through Rosetta
`80f3c13ce48dc3318d5d49f54958f580937ca8aa`. Authored source and bytecode hashes are
in `tests/fixtures/temporary-provenance/manifest.json`. `source-hashes.json`
identifies the engine source used to build the immutable candidate snapshot.
The snapshot was unchanged across authored checks and both tiers. Default
engine options were used; no environment override was supplied.

Commands, with absolute snapshot paths substituted:

```sh
npm run build
npx vitest run --maxWorkers=2
RAYON_NUM_THREADS=4 rosetta bench --tier quick --decompiler 'candidate=node SNAPSHOT/dist/cli.js decompile {}' --out QUICK_OUT
RAYON_NUM_THREADS=4 rosetta bench --tier hard-quick --decompiler 'candidate=node SNAPSHOT/dist/cli.js decompile {}' --out HARD_QUICK_OUT
RAYON_NUM_THREADS=2 rosetta check tests/fixtures/temporary-provenance --profiles O0g1,O1g1,O2g1,O0g2,O1g2,O2g2,O0g1+x1,O1g1+x2,O2g1+x3,O0g2+x2,O1g2+x3,O2g2+x1 --decompiler 'before=node BEFORE/dist/cli.js decompile {}' --decompiler 'after=node SNAPSHOT/dist/cli.js decompile {}' --report authored.json --work FAILURES_OUT
```

The authored comparison exits nonzero because the **before** engine fails four
controls; its candidate total is verified separately as `48 pass` with no other
verdicts. Final integration still needs the combined engine's four Rosetta tiers
and required CI gates. This checkpoint does not claim the requested 82.2%, 90%
or 100% source-similarity targets.
