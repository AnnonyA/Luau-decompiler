# Named record closures and ordered creation

This independently implemented presentation pass returns a private, adjacent,
single-use named function to a record field only when the field preserves its
existing debug name. The engine uses lexical bindings and evaluation order;
it does not consult original sources or benchmark identifiers.

The function binding must have no writes, captures or second reader. Recursive
functions and required closure-identity initializers remain declarations.
The new field position must execute once and unconditionally, with no preceding
call, lookup, unknown global read, or potentially invalid table store. Table
templates and field order remain intact. A uniform table exporting multiple
named helpers keeps its declarations rather than nesting only an adjacent
suffix. `foldSingleUseTemps=false` disables the new presentation pass.

## Diagnostic quality

These are exact replays of all 882 unchanged Quick bytecodes with Rosetta's
pinned token scorer, **not behavioral release results**. The integrated strict
run is reported separately. Both comparisons use this round's reproduced
77.49586128999316% baseline; the older 72.29585% baseline embedded in the replay
tool's receipt is historical.

| Candidate | Source similarity | Gain over this round's base | Better / unchanged / worse profiles |
| --- | ---: | ---: | ---: |
| Initial presentation | 77.54164472594013% | +0.04578343594697 pp | 98 / 772 / 12 |
| Preserve helper export groups and throwing stores | 77.55666675886600% | +0.06080546887284 pp | 98 / 784 / 0 |

The initial candidate nested two functions at the end of a large API table,
splitting a uniform set of named exports. The second retains that general
source structure. Both complete per-profile metrics and source/output hashes
are preserved in `v1-quality.json.gz` and `v2-quality.json.gz`.

## Independent controls and retained first failures

The three authored sources in `tests/fixtures/named-table-closures` were sealed
with O0/O1/O2 and g1/g2 under both official Luau revisions below: 36 input
profiles. They exercise mutable captures, repeated closure identity and table
keys, environment changes before fields, metatable reads, recursive functions,
shadowed locals, aliased function names, empty returns and nil-bearing packs.

The **first baseline and first candidate each pass 24/36**. The same twelve
preexisting failures lose function debug names: aliased named functions and
shared closures returned from a synthesized factory. This presentation pass
does not cause or repair those initial failures. `first-native.json.gz` and
`first-native-observations.tar.gz` retain the exact stdout, stderr, commands,
sources and bytecode observations. The first compiler sources and bytecodes
remain unchanged. The final integrated results must close these failures
before claiming the complete native control set passes.

Independent review also found an ordering obligation: a nil/NaN table key can
throw before a newly embedded closure is created, changing which activation
primes a shared closure constant. `invalid-key-cache-control.luau` preserves
the direct native counterexample. The common creation-order proof now treats
such stores as potentially throwing, including inside nested constructor
prefixes. The store check occurs after its key and value, so a closure created
in that same value still precedes the error.

## References

Inspected Tovek revision `ce2ea3325547fa3896f274b68013386338039040`,
[`inline_temps.rs`](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/inline_temps.rs)
and [`local.rs`](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/local.rs),
for the distinction between preserving a function's field name and separately
proving motion. Its license is MIT, copyright Jujhar Singh and Mathias Pedersen
(2024). No implementation code was copied or adapted.

Official Luau
[`Parser.cpp`](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Ast/src/Parser.cpp)
assigns a debug name to a direct named constructor field;
[`Compiler.cpp`](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/Compiler.cpp)
preserves it in each prototype and controls constructor allocation and field
stores. Native controls use that revision and
`9d7748a4f324213a18cb8283fa2a77c330225fa0`. The exact compiler and VM-host hashes
are recorded in the fixture manifest and first-native receipt.
