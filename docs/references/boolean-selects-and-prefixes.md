# Boolean selects and primitive logical prefixes

This independently implemented reconstruction change uses two bounded proofs.
It introduces no helper call or new closure capture.

## Boolean selects

An `if` expression with a literal boolean arm can use `and` or `or` when its
test is proved to produce a boolean. Comparisons, `not`, and logical combinations
of boolean operands satisfy that proof. Arbitrary identifiers, properties and
calls do not: replacing a literal `false` arm with a nil test value changes the
result. Ordering comparisons retain explicit negation because NaN prevents
inverting `<` into `>=`. Function literals keep their naming and creation form.

The resulting binary expression preserves selection order and one-result
adjustment, including a selected call returning zero values or nil-bearing packs.
An initial experiment also rewrote inverse selects on arbitrary truthiness
tests. It was behaviorally valid on the authored controls but reduced Quick
similarity, and is not part of the accepted implementation.

## Primitive logical prefixes

The existing private-result proof now accepts intermediate values known to be
primitive, as well as its previous immutable parameter inputs. Comparisons and
`not` produce booleans. `left and primitive` returns either nil/false or the
proved primitive right value. `or` needs both sides proved primitive. Conditional
expressions need every result arm proved primitive.

This permits flat early-return chains to recover a short-circuit expression.
A prefix can also join adjacent guards while retaining the cell and final guard
before a complex remaining tail. Removing a private intermediate primitive
cannot release its own last object reference. Ordinary object-valued locals,
unknown calls, mutable or captured result cells, closure literals, residual
reads and open final return packs remain outside the proof. All selected effects
stay at the same point in the chain.

## Evidence

[Measured development controls and diagnostic scores](../../benchmarks/results/boolean-selects-2026-11-27/README.md)
retain the original sources, 24 normal/hard bytecodes, baseline observations and
candidate observations. The controls exercise false/nil/truthy values, comparison
metamethods, NaN, nil-bearing and empty return packs, callback frame arity, capture
snapshots and the ordering of selected calls. Unit tests also exercise refusal
of object-valued intermediate cells and opposite-polarity prefix guards.

Quick diagnostic replays use the unchanged Rosetta metric and all 882 frozen
inputs with default engine options. They are explicitly not release behavioral
measurements. The integrated four-tier release report supplies final acceptance.

## References inspected

- Official Luau [`c87565b8`](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/Compiler.cpp)
  and [`9d7748a4`](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/Compiler.cpp):
  `compileConditionValue`, `compileExprAndOr` and conditional-expression lowering.
- Tovek [`ce2ea332`](https://github.com/Kiet1308/Tovek/tree/ce2ea3325547fa3896f274b68013386338039040):
  `ast/src/compact_conditionals.rs`, `conditional_expressions.rs`,
  `factor_common_tails.rs`, and its MIT license. These supplied engineering
  reference points; no Rust implementation was copied or adapted.
