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

`stable-capture-constant` and `branch-closure-constant` extend the O2 identity
regressions to a shared table capture and separate dominated blocks.
`different-closure-captures` must retain distinct function objects. The optional
`inputs.json` matrix runs the branch program with both outcomes; all inputs must
match for any profile to pass.

`nan-closure-capture` checks that a NaN value does not make two cached closures
equal, with three inputs. `changed-closure-environment` checks cloning after the
parent changes its environment. `capture-free-after-call` and
`nested-capture-free` preserve previously supported closure identities. All four
were added during review; they are development regressions.

`inlined-numeric-helper` and `inlined-numeric-arguments` cover exact recovery of
existing numeric helpers, repeated occurrences, operand order and multiple call
arguments. `inlined-argument-effects` preserves effectful argument evaluation;
`inlined-repeat-continue` prevents helper declarations skipped by continue from
being called in until. Inputs are listed in `inputs.json`; these are authored
development regressions, compiled at the pinned revision above.
