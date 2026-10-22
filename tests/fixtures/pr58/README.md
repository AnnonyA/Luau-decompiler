# PR58 bytecode regressions

These are byte-for-byte copies of our original `codec` and `branch-phis` O0
benchmark artifacts, compiled using official Luau revision
`9d7748a4f324213a18cb8283fa2a77c330225fa0`, `--binary -O0 -g1`.
Sources: `benchmarks/originals/{codec,branch-phis}.luau`.
The original files and competitor outputs are unchanged.

SHA-256:
ea9bade2ddddff76245eae4fb1528fd7fc9b16ee68cb6a4cbda2847c98a7c02c  tests/fixtures/pr58/branch-phis-O0.luauc
5338e3900277501c9972ac823739d6b686eea67b8e5f9d2f3f58803741f62412  tests/fixtures/pr58/codec-O0.luauc
