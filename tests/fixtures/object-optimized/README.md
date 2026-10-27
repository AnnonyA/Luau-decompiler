# Object identity and initialization order

Project-authored source reductions. The adjacent bytecode was produced with the
pinned official Luau revision `9d7748a4f324213a18cb8283fa2a77c330225fa0`,
`luau-compile --binary -O0/-O1/-O2 -g1`.

`method-alias` previously created two closures instead of preserving one shared
identity. `metatable-overwrite` and `self-reference-overwrite` previously deferred
self writes past later overwrites. `metatable-constructor` and `inlined-registers`
exercise related construction and O2 paths.

Unit tests use the exact saved bytes. `bench:large:regressions` recompiles these
sources with the official compiler, parses and executes the reconstructions,
and compares observed traces. `--name-styles` covers all naming configurations.

`duplicate-closure-constant` preserves function equality when O2 inlines two
loads of one capture-free closure constant. O0 intentionally produces distinct
closures; O1/O2 share the constant. Each profile must retain its own behavior.
