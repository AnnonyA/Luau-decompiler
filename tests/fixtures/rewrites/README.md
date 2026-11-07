# Rewrite development regressions

These three originals were authored for this project. They are development
regressions, not a blind competitive evaluation. `inputs.json` supplies three
inputs per source. The neighboring bytecode was compiled using official Luau
`9d7748a4f324213a18cb8283fa2a77c330225fa0`, `--binary -g1 -O0/-O1/-O2`.

- `inlined-fixed-tuple`: recover one retained helper with three results, retaining
  a boolean destination in the outer lexical scope.
- `options-effects`: captured mutable cells, fixed returns including nil, UTF-8
  and invalid bytes, module functions, guard branches and ordered observations.
- `numeric-rewrites`: exact repeated math literals, unrolled numeric updates and
  fresh closure identities.

`bench:large:regressions --rewrite-options` compares the same compilation against
all 17 option configurations and preserves source/bytecode hashes and VM traces.
No external API is used. Unit tests also exercise these checked-in bytes, so
structure assertions do not silently move with a newly installed compiler.
