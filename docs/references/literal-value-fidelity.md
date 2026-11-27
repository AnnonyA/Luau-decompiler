# Integer and vector literal fidelity

This is a bounded correction based on official Luau
[`9d7748a4f324213a18cb8283fa2a77c330225fa0`](https://github.com/luau-lang/luau/tree/9d7748a4f324213a18cb8283fa2a77c330225fa0).
The 12 saved original inputs and reproduction commands are in
[`tests/fixtures/literal-fidelity`](../../tests/fixtures/literal-fidelity/README.md).

## Integers: the printer was the first semantic loss

The loader gives `LBC_CONSTANT_INTEGER` an integer tag and keeps its signed
64-bit value ([lvmload.cpp:657–662](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lvmload.cpp#L657-L662)).
Our decoder and AST already retained a `bigint`. Both the printer and constant
formatter then emitted its decimal digits without `i`. Recompilation created
a floating-point number, changed `typeof`, and collapsed adjacent integers
above 2^53. Both output paths now share the integer formatter and preserve `i`.

`-9223372036854775808i` is not a usable decimal spelling: the parser reads the
positive magnitude before applying unary minus. Decimal magnitudes must fit
signed 64 bits; hexadecimal and binary literals represent all 64 bits
([Parser.cpp:3963–4012](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Ast/src/Parser.cpp#L3963-L4012)).
The minimum is therefore emitted as `0x8000000000000000i`. Ordinary negative
integer literals retain the printer's unary/power parentheses.

The annotation `integer` is an official builtin type under `LuauIntegerType2`
([GlobalTypes.cpp:20–22](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Analysis/src/GlobalTypes.cpp#L20-L22));
integer literals infer that type
([TypeInfer.cpp:1953–1956](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Analysis/src/TypeInfer.cpp#L1953-L1956)).
This same flag enables the `i` syntax
([Parser.cpp:5116–5136](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Ast/src/Parser.cpp#L5116-L5136)).
We use the official type rule, not a name guessed from the runtime `typeof`
string. Recompilation still requires an integer-enabled official compiler.

## Vectors: retain w, expose the constructor assumption

The wire formats VECTOR and VECTORD both carry **four** components
([lvmload.cpp:526–547](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lvmload.cpp#L526-L547)).
Our decoder retained `w`, but `constantExpr` discarded it before creating the
call AST. The reconstructor and standalone formatter now pass all four
components. The disassembler includes `w` and distinguishes `vector64`.
The native constructor consumes its fourth argument in a VM built with
`LUA_VECTOR_SIZE=4`
([lveclib.cpp:10–27](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lveclib.cpp#L10-L27)).

`precise` records the wire format, not the active VM precision. Both loader
cases call `setvvalue`, which converts components according to
`LUA_VECTOR_DOUBLE` and discards w in a three-component VM
([lobject.h:131–149](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lobject.h#L131-L149)).
Likewise, O2 constructor folding uses the separate compiler option
`vectorPrecision`, and can narrow a source call when set to 0
([BuiltinFolding.cpp:598–619](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/BuiltinFolding.cpp#L598-L619),
[Compiler.h:52–62](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/include/Luau/Compiler.h#L52-L62)).
No claim of full precision portability follows from retaining all four numbers.
The precise-vector unit test checks preservation of decoded components and
the diagnostic; it is not a VM-double execution measurement.

A constant contains no callable constructor capability. A custom compiler
`vectorCtor` may already have disappeared after folding, and the ambient
`vector.create` can have been replaced before the reconstructed call. Every
vector K therefore produces a `vector-constructor-assumption` warning that
identifies its prototype and first referenced PC when available. This warning
states the native-constructor and compatible compiler/host requirements.
It does not turn a divergence into a match, create an alias, or claim a repair.

## Measured results and limits

The exact 12 sealed inputs were executed and compared again. No opcode PC
instrumentation or competitor queries were performed for this change.

| Group | Before (frozen e26040a) | Corrected candidate | Scope |
| --- | --- | --- | --- |
| Integer64 API, O0/O1/O2 | 0/3 MATCH | 3/3 MATCH | Bytecode v9 |
| Integer64 CLI, O0/O1/O2 | 0/3 MATCH | 3/3 MATCH | Bytecode v14 |
| Vector w, O0/O1/O2 | 2/3 MATCH | 3/3 MATCH | VM4, float components |
| Replaced vector constructor, O0/O1/O2 | 2/3 MATCH | 2/3 MATCH | O2 remains an execution divergence |

The integer original and corrected output retain the two distinct values
`9007199254740993` and `9007199254740992`, each tagged `integer`. The old
source printed both as the number `9007199254740992`. The VM4 O2 vector now
prints `1, 2, 3, 4`; the old source printed `1, 2, 3, 0`. The remaining O2
constructor counterexample prints `vector, 1, 2, 3, 0` originally versus
`string, replacement, 1` after reconstruction (tab-separated observation
fields; the vector's own text contains commas). The complete runner exits 1.

The additional integer boundary source was compiled and executed at O0/O1/O2
with the API integer flag. Its original and reconstructed outputs match for
zero, -1, 2^53+1, the signed maximum and signed minimum. These three checks are
reported separately from the 12 archived profiles.

The wider audit attempted CMPPROTO generation with compiler feedback flags,
but the pinned compiler produced no CMPPROTO for those sources. That is a
generation limit, not execution coverage or a reason to invent a lowering.
This patch makes no CMPPROTO change.

## Tovek reference

Inspected Tovek at
[`77edf387bf280a2f4d46d57ac85d5c4f071b763f`](https://github.com/Kiet1308/Tovek/tree/77edf387bf280a2f4d46d57ac85d5c4f071b763f),
MIT license (Jujhar Singh and Mathias Pedersen, 2024).
Its formatter retains integer suffixes and handles the minimum value
([literal.rs:228–229](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/ast/src/literal.rs#L228-L229));
its vector lifting represents only x/y/z
([lifter.rs:1924–1926](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/luau-lifter/src/lifter.rs#L1924-L1926)).
These are source observations. We did not execute Tovek for this matrix and
make no measured superiority claim. The TypeScript correction was implemented
independently from the official parsing/loading rules; no Rust was copied.
