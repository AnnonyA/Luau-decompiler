# Rewrite development regressions

These originals were authored for this project. They are development
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

The guarded-loop/FASTCALL round adds four independent originals:

- `guarded-polling`: a coroutine repeatedly yields before visibility/readiness
  guards and nested generic iteration. False guards must skip work, not stop it.
- `fastcall-observations`: variadic builtins consume effectful arguments exactly
  once; nested min operations must not be emitted as both discarded and used.
- `loop-input-observations`: metatable observations prove that generic iterator
  expressions and numeric bounds/step are each evaluated exactly once.
- `fastcall-fallback-environment`: native and replacement environments exercise
  builtin fallback calls, open argument packs and fixed multiple return counts.

Each has three deterministic inputs and pinned O0/O1/O2 bytes. These reductions
were authored independently of the supplied Roblox script; no uploaded user
source or bytecode is included in this corpus.

The lexical-helper/presentation round adds `inlined-lexical-helpers` (scalar and
fixed-tuple helpers already captured by named, anonymous and nested consumers),
`named-function-cells` (forward cells, recursion, old-value aliases and mutable
counters), and `anonymous-function-name` (`debug.info` must retain an anonymous
closure's empty name). Each has three inputs and pinned O0/O1/O2 compilations.
They are development regressions. The first draft of `named-function-cells`
accidentally printed a process-dependent function address; the checked-in source
observes identity through equality instead. No sealed benchmark was changed.

The source-structure round adds three independent development regressions:

- `layout-evaluation-order`: chained method receivers, observable lookup/argument
  order, fixed one-result returns and empty/nil-containing vararg packs.
- `layout-scopes-tables`: terminal guards with captured locals, nonterminal local
  shadows, nested table identities and reassigned/shadowed constructor inputs.
- `layout-repeat-scopes`: direct and closure reads in `until` must retain the
  receiver/table cells declared inside the repeat body.

All have three deterministic inputs and pinned O0/O1/O2 bytes.

The return-structure round adds `return-selection` (scalar versus open returns,
nil/false, sorting and branch call traces) and `getter-result-scopes` (owned table
results, nested readers, globals, parameter collisions and multiple returns).
`getter-debug-names` checks that inferred names and optional naming styles do not
alter the prototype names of later functions, including suffix collisions.
All three are independent development regressions with three inputs and pinned
O0/O1/O2 bytes; no existing fixture was changed.

`fallback-property-names` adds field-role naming through literal defaults, with
observable metamethod reads, nil/false values, nested captures, sorted results
and an explicit function name that competes with an inferred field name. It has
three inputs and pinned O0/O1/O2 bytes.

`reassigned-function-name` preserves a function's observable prototype name when
its local is later overwritten by a field fallback. A saved alias still calls
the original function. It also has three inputs and pinned O0/O1/O2 bytes.
