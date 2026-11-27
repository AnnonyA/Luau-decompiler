# Comment diagnostics inside nested interpolation

The comment detector now distinguishes string text from the expressions between
interpolation braces. Nested backticks open another string frame; they cannot
close the outer string. Escaped braces and Unicode escapes stay literal text.
Actual comment markers inside expression frames are still rejected, including
inside a nested interpolation. Long string contents are treated as literals.

The implementation is independent TypeScript. The inspected references are
Tovek `ce2ea3325547fa3896f274b68013386338039040`, MIT, `ast/src/formatter.rs`
(nested interpolation and escaping tests), and official Luau 0.747
`c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`, `Ast/src/Lexer.cpp`
(`readInterpolatedStringSection` and its brace stack). No source was copied.

`tests/fixtures/rosetta-printer/nested-interpolation.luau` is project authored.
It exercises literal comment-looking text at two interpolation depths under
official O0/O1/O2 compilation and both debug levels. The first before/after
observations are preserved in `benchmarks/results/rosetta-interpolation-2026-11-27`.
