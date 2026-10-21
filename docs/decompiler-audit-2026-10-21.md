# Decompiler correctness audit — 2026-10-21

This round prioritizes changes that preserve observable behavior. The review
covered decoding, control flow, SSA, reconstruction, AST cleanup and printing,
with additional probes of naming, runtime context and HTTP handling. It is not
an exhaustive certification of every source file or every accepted bytecode.

## Implemented corrections

| Area | Correction | Regression coverage |
| --- | --- | --- |
| Constant operands | Preserve the full AUX constant index for GETTABLEKS, SETTABLEKS and NAMECALL; retain the low-16-bit encoding for their userdata variants. Reject missing high-index constants instead of aliasing a low index. | `extended-constant-operands.test.ts` |
| Repeat loops | Compare CFG block IDs with block IDs, including the latch condition. Do not turn an arbitrary comparison-controlled assignment into a truthiness expression. | `natural-loop-regions.test.ts`, `repeatbranch.luau` |
| Evaluation order | Materialize expressions before intervening mutation or statement-producing calls when delaying their evaluation would reorder them. | `call-evaluation-regressions.test.ts`, `evaluationorder.luau` |
| Fixed result counts | Parenthesize a final call/vararg expression when a fixed CALL argument or RETURN slot requires exactly one value. | `call-evaluation-regressions.test.ts`, `fixedresults.luau` |
| Open result packs | Preserve forwarded packs without collapsing them into a single local. Expire reused pack bindings, and consume call arguments before replacing overlapping result registers. | `call-evaluation-regressions.test.ts`, existing `varargs.luau` |
| Method calls | Exclude the implicit receiver from an open argument list. | `call-evaluation-regressions.test.ts`, `openmethod.luau` |
| Concatenation | Reconstruct CONCAT as right-associated operations to preserve metamethod order. | `call-evaluation-regressions.test.ts`, `concatorder.luau` |
| AST cleanup | Keep double negation as boolean coercion, avoid collapsing open-return branches into single-valued if expressions, and retain computed nil keys whose evaluation is observable. | `semantic-cleanup-regressions.test.ts`, `booleancoercion.luau`, `returnbranches.luau`, `computednilkey.luau` |
| Numeric printing | Parenthesize negative numeric bases under exponentiation, including negative zero and integer literals. | `printer-precedence.test.ts`, `negative-power-literals.test.ts` |

The new semantic fixtures are permanently included in the benchmark allowlist
and mandatory baseline. Some earlier textual expectations were corrected to
require parentheses that enforce a single return value.

## Validation of the first round

Validation used Node.js 24.19.0 and official Luau commit
`9d7748a4f324213a18cb8283fa2a77c330225fa0`, built locally. Results apply to
this working-tree change, not to a published release or a remote CI run.

- TypeScript typecheck and build passed.
- All 309 unit tests across 46 files passed.
- All 24 benchmark-runner tests passed.
- All 38 controlled semantic comparisons matched: 19 repository-owned programs
  compiled with both `-O0 -g1` and `-O1 -g1`, comparing stdout, stderr and process
  success with the original source under the official VM.
- All 25 generated sources passed the official parser: three local fixtures
  and 22 locked external bytecode fixtures. External code was not executed.

Commands, after obtaining the pinned dependencies described in
[the benchmark guide](../benchmarks/README.md):

```sh
npm ci
npm run typecheck
npm run build
npm test
npm run bench:test
npm run bench:semantic -- --luau-compile /path/to/luau-compile --luau /path/to/luau --output /tmp/semantic.json
npm run bench:compare -- --lunaux-dir /path/to/lunaux-decompiler --require-lunaux-count 22 --luau-compile /path/to/luau-compile --output /tmp/syntax.json
node scripts/bench-assert-syntax.mjs /tmp/syntax.json --require-all-pass
```

Matching these selected execution traces is not proof of general equivalence.

## String-fidelity follow-up

The follow-up fixes two of the findings below:

- Concatenations are converted to interpolation only when their operands are
  statically known strings (string literals or existing interpolation nodes).
  Unknown identifiers, properties and calls retain `..`, preserving type errors
  and `__concat`. Existing interpolation nodes remain nested to preserve their
  own evaluation and conversion order.
- `string.format` calls are retained. The AST has no proof that `string` refers
  to the builtin library, and `%s` has different coercions from interpolation.
  This also preserves custom format functions and their multiple results.
- Interpolation text escapes newlines, carriage returns, tabs and control bytes.
  Decimal escapes use three digits to prevent subsequent digits changing the
  decoded byte. Backslashes, backticks, braces and Unicode are preserved.

Validation: 331 unit tests, 24 benchmark-runner tests, and 42/42 controlled
semantic comparisons passed; all 25 generated corpus sources passed the official
parser. The new `concatsemantics` and `formatsemantics` programs are mandatory
O0/O1 checks. Separate direct-AST probes exercised all 32 control bytes followed
by digits, delimiters, Unicode and nested interpolation under the official VM,
comparing its reported bytes with JavaScript's UTF-8 encoding of the input.
These direct-AST VM probes were local validation; permanent regression coverage
for interpolation emission is in `tests/string-rewrite-fidelity.test.ts`.

The following findings remain outside the completed corrections.

## Remaining findings and next work

These were observed with focused local probes. Some target individual AST
passes directly rather than the entire compiler/decompiler pipeline; distinguish
those cases when turning them into permanent regressions.

1. **Preserve string bytes** (`BytecodeReader.ts`, string constants and printer).
   UTF-8 decoding replaces invalid bytes and strips a leading BOM. Compile and
   round-trip the following source, then compare byte counts and values:

   ```luau
   local s = "\255\128\0A"
   print(#s, string.byte(s, 1, #s))
   local bom = "\239\187\191x"
   print(#bom, string.byte(bom, 1, #bom))
   ```

   This needs a consistent byte-preserving representation and escaping policy,
   not merely a different replacement character.

2. **Respect binding identity in naming and cleanup** (`NameInference.ts`,
   `RuntimeContext.ts`). Direct AST probes found that coalescing two zero-valued
   locals can remove the second initialization, compound assignments can lose
   the declaration they read, and inlining `{ x = n }` after changing `n` alters
   the captured value. Names used in loop bodies can be dropped. Renaming can
   capture globals, miss parameter/loop declarations or repeat-condition scope,
   collide with existing locals, and rename a field in a function declaration
   without renaming its matching access. Start with lexical binding and read/write
   analysis before further cosmetic naming changes.

3. **Constrain other semantic rewrites** (`AstCleanup.ts`). Concatenation and
   formatting issues are addressed in the string-fidelity follow-up above.
   Approximate numeric constants and a shadowed
   `math` binding make symbolic constant substitution unsafe. Function lifting
   can change which binding a recursive-looking identifier captures, and callback
   parameter renaming can miss assignment targets or introduce collisions.

4. **Preserve evaluation and capture semantics more broadly**
   (`Reconstructor.ts`). The new statement barriers cover the checked cases,
   but do not establish a general ordering guarantee for nested calls and reads.
   Value captures can retain expressions such as `t.x` or `get()` and evaluate
   them inside the closure instead of taking a snapshot. Terminal branches can
   leak register bindings into the other arm. Fixed final table elements also
   need the single-result protection now used for calls and returns.

5. **Strengthen control-flow boundaries and scalability**
   (`ControlFlowGraph.ts`, `Dominators.ts`, `SsaBuilder.ts`). Instructions after
   RETURN can remain in the same reachable block. LOADB skip and FORGPREP
   transfers need their unconditional edges modeled correctly. Large branch
   chains can exhaust recursive graph traversals within accepted input limits.
   Reconstruction dependencies on the current edge model need regression tests
   before changing it.

6. **Handle remaining source-printing boundaries** (`LuauPrinter.ts`). Direct
   AST probes found ambiguous adjacent call statements when the next statement
   starts with a parenthesized expression. Interpolation text escaping is fixed
   in the string-fidelity follow-up above.

7. **Contain malformed HTTP URL errors** (`server.ts`). A request with
   `Host: [` makes URL construction throw outside the request error handler.
   A local child-server probe exited with status 1. Parse malformed request URLs
   within the handler's error boundary and add a process-level regression that
   checks the server remains responsive afterward.

Additional decoder hardening should examine register/upvalue bounds and
version-specific constant tags. Those checks require a dedicated malformed-input
matrix; they are not claimed as completed by this round.
