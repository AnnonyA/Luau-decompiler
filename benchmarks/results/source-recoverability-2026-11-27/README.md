# Recoverability limits of Rosetta source similarity

This is a read-only, project-authored diagnostic. No engine, pinned Rosetta checkout, or sealed benchmark evidence was changed.

## Concrete information loss

Eight one-line source files were independently authored here and compiled with the existing pinned Rosetta binary, at all six ordinary O0/O1/O2 × g1/g2 profiles. `bytecode-equality.json` records the SHA256 and length of every produced bytecode file. `token-shapes.tsv` was produced by compiling a small diagnostic that imports the **actual, unchanged Rosetta lexer** and uses the exact token-kind normalization from `quality.rs`.

| Pair | Source A | Source B | Profiles with byte-for-byte identical output |
| --- | --- | --- | --- |
| Constant folding | `return 1 + 2` | `return 3` | O1g1, O2g1, O1g2, O2g2 |
| Dead branch | `if false then print("unused") end return 3` | `return 3` | O1g1, O2g1, O1g2, O2g2 |
| Type assertion | `return (7 :: number)` | `return 7` | All six profiles |
| Inlined call | `local function helper(x) return x + 1 end return helper(4)` | `local function helper(x) return x + 1 end return 5` | O2g1, O2g2 |

All four pairs have different normalized token sequences: respectively 4 vs 2, 10 vs 2, 6 vs 2, and 16 vs 13 tokens. For example, constant folding makes `return 0 + 0` and `return 0` indistinguishable in bytecode at O1/O2. The common constant-fold/dead-branch bytecode is 41 bytes with SHA256 `0ed85e4d52610de16cdaeb9a352b96062ea000cac646005e0d6a53e667931d4a`.

Consequently, a bytecode-only decompiler cannot guarantee 100% normalized source-token similarity for both originals in any such pair: it receives exactly the same input, while a perfect match requires different token sequences. Likewise it cannot guarantee a token-size ratio of exactly 1 for both originals. This is an existence proof of ambiguity, **not** a numerical upper bound for Rosetta's particular finite corpus, and it does not establish that 82.2% or 90% is unreachable.

The practical target is to remove reconstruction-introduced scaffolding while preserving behavior. Reintroducing arbitrary dead branches, numeric expressions, or type assertions solely to imitate an unknown source would not recover information from bytecode. O2 helper reconstruction remains useful when justified, but even the surviving helper prototype in the fourth pair cannot prove whether the original caller used a helper call or a literal.

## Exact references inspected

- Official Luau **c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f** (0.747): [Compiler options](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/include/Luau/Compiler.h#L27-L43) define O2 as including inlining, g1 as line/function names only, and g2 as full local/upvalue debug names. Original local spellings absent at g1 cannot be uniquely recovered.
- [Constant arithmetic folding](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/ConstantFolding.cpp#L124) and [constant-false branch elimination](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/Compiler.cpp#L3990-L3999) explain the first two pairs. The official [IfElimination tests](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/tests/Compiler.test.cpp#L11851) also show entire branches disappearing.
- [Type assertion expression compilation](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/Compiler.cpp#L3516) emits the asserted expression. [Type-alias/type-function statements](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/Compiler.cpp#L5279-L5287) do not retain the original source syntax as executable statements. Optional type metadata should not be confused with lossless source annotations.
- [Inlining entry](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/Compiler.cpp#L956) and [InlineBasic tests](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/tests/Compiler.test.cpp#L7114) document call-site expansion and constant substitution. The local example above verifies a complete serialized-bytecode collision, including the surviving helper.
- Tovek **ce2ea3325547fa3896f274b68013386338039040**: [deinline_safety.rs](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/deinline_safety.rs#L1-L47) explicitly separates cell identity, writes, copied captures, dynamic environment and frame observations. These are useful constraints for global reconstruction improvements; a spelling/type hint alone is insufficient. No implementation code was copied or adapted.
- Rosetta **80f3c13ce48dc3318d5d49f54958f580937ca8aa**: [quality.rs](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/src/quality.rs#L26-L59) maps all names to `n`, numbers to `0`, strings to `s`; therefore renaming alone does not improve this similarity. Genuine debug-name retention has a separate metric. [lex.rs](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/src/lex.rs#L43) skips comments/whitespace, so formatting is also separate from the token-shape target.

## Reproduction

Example command (all paths point to this scratch diagnostic and the existing pinned binary):

```sh
/workspace/scratch/eb5e4be57451/rosetta-research/target/release/rosetta compile --profile O2g2 --output constant_fold-a-O2g2.luauc constant_fold-a.luau
```

The JSON manifest preserves all 24 comparisons, including profiles where the bytecode is different. The first compiled bytes are retained unchanged. No claim of exact metric percentages is made here; the parent diagnostic uses Rosetta's actual Myers implementation for those scores.
