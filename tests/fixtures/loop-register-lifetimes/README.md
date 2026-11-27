# MOVE values must survive reuse of the source register

`move-closure-loop.luau` is a 38-line reduction of an independently authored
physics/game-system failure. The source and the six original bytecodes were
sealed before this repair. `provenance.json` records their hashes and the exact
official compiler revision. No bytecode header was edited to obtain a version.

## First divergence

In the v9/O2 main prototype P6, the compiler inlines `makeDriver`. The stop closure
is created in a scratch register and then copied to its long-lived result slot:

| PC | Instruction | Value lifetime |
| --- | --- | --- |
| 19 | `NEWCLOSURE R10` | Create `stop`, capturing active state by REF. |
| 20 | `CAPTURE REF R7` | Bind its state cell. |
| 22 | `MOVE R4 R10` | Save the same function object in R4. |
| 23 | `CLOSEUPVALS R6` | Close captured cells; this does not modify R4 or R10. |
| 42 / 44 | `LOADK R10` | Reuse the dead scratch slot for a numeric frame delta. |
| 51 / 53 | `MOVE R8/R9 R4` | Read the saved function after the loop. |
| 52 / 54 | `CALL R8/R9` | Invoke it twice: `true`, then `false`. |

The decoder and SSA preserve these lifetimes. In this fixture the closure is SSA
v14 (R10, PC19), its copy is v16 (R4, PC22), and the branch join for R10 merges the
numeric definitions at PCs42/44. The closure is not an operand of that numeric
phi.

At base `e26040ae485b6e45eb7fa1b301903e3017c81fd7`, the reconstructor still lets
`existingPhiName(10)` reuse the lexical name `stop` for the numeric branch phi.
`snapshotRegisterAliases` attempts to protect the R4 alias inside each branch.
Those snapshots live inside the loop, while `emitLoop` restores the unwritten
R4 environment entry from before the loop. The raw AST is already wrong before
cleanup: the saved call again refers to `stop`, now assigned a number. Cleanup
merely removes the unused branch-local snapshots.

## Repair and proof boundary

Before emitting a loop, retire assignment ownership of a pinned incoming
register binding only when all of the following hold:

* The loop writes that physical register.
* The binding is neither a borrowed alias nor an open REF cell.
* Existing CFG analysis proves that no reachable instruction reads its incoming
  value before a definition. The analysis includes the continuation, so a
  zero-iteration loop cannot discard a value read afterward.

The old binding remains readable by saved MOVE copies and existing closures.
Only the dead scratch register becomes an alias; later phi reconstruction must
choose a different lexical assignment target. The proof uses register reads,
writes, CFG paths, and capture-cell state. It does not inspect fixture names,
debug names, function bodies, or the `CLOSEUPVALS` opcode pattern.

The unit test covers all six official bytecodes, two synthetic MOVE/branch-loop
cases with and without `CLOSEUPVALS`, an open REF cell that must keep receiving
loop writes, and an incoming value that must survive zero iterations. The new
tests run against the unmodified base produce **3 failures / 7 passes**; the
repair produces **10 passes**. Existing assertions were not changed.

## Measured results

Every original prints `true\tfalse\n`, with empty stderr and exit0.

| Bytecode | Optimization | Base e260 reconstruction | Repaired reconstruction |
| --- | --- | --- | --- |
| v9 | O0 | `true false`, exit0 | `true false`, exit0 |
| v9 | O1 | `true false`, exit0 | `true false`, exit0 |
| v9 | O2 | `attempt to call a number value`, exit4 | `true false`, exit0 |
| v14 | O0 | `true false`, exit0 | `true false`, exit0 |
| v14 | O1 | `true false`, exit0 | `true false`, exit0 |
| v14 | O2 | `true false`, exit0 | `true false`, exit0 |

The larger independent corpus moved from **22/24 to 24/24 matching profiles**:
two systems, twelve exact bytecodes, two input sequences each, and four
activations per load. Comparison includes stdout, stderr, exit status, table-key
identity observations, private counter state, and checksums. Its first 48
engine/profile observations and original seal
`ea4a9e0e61c66b9ee5e42ba136e65a316424736ce86bd1a4c9f7e743bfc6598a`
remain unchanged. This fixture folder contains the small reduction, not the
larger corpus. Complete unit suites passed **837/837 on Node20 and Node22**.

## Reproduce

From the repository root, set `LUAU_SRC` to a checkout of
`9d7748a4f324213a18cb8283fa2a77c330225fa0`. These commands use that revision's
Make build; the API defaults emit v9, while the CLI initializes its flags and
emits v14. Both use debug level2.

```sh
make -C "$LUAU_SRC" config=release luau luau-compile
mkdir -p /tmp/luau-move-lifetime
c++ -std=c++17 -O2 \
  -I "$LUAU_SRC/Compiler/include" -I "$LUAU_SRC/Ast/include" \
  -I "$LUAU_SRC/Common/include" scripts/closure-identity/compile_api.cpp \
  -Wl,--start-group "$LUAU_SRC/build/release/libluaucompiler.a" \
  "$LUAU_SRC/build/release/libluauast.a" \
  "$LUAU_SRC/build/release/libluaubytecode.a" \
  "$LUAU_SRC/build/release/libluaucommon.a" -Wl,--end-group \
  -o /tmp/luau-move-lifetime/compile_api
c++ -std=c++17 -O2 -I "$LUAU_SRC/VM/include" \
  scripts/closure-identity/run_bytecode.cpp \
  "$LUAU_SRC/build/release/libluauvm.a" \
  "$LUAU_SRC/build/release/libluaucommon.a" \
  -o /tmp/luau-move-lifetime/run_bytecode

FIXTURE=tests/fixtures/loop-register-lifetimes
/tmp/luau-move-lifetime/compile_api "$FIXTURE/move-closure-loop.luau" 2 \
  /tmp/luau-move-lifetime/original-v9-O2.luauc
cmp "$FIXTURE/move-closure-loop-v9-O2.luauc" \
  /tmp/luau-move-lifetime/original-v9-O2.luauc
"$LUAU_SRC/luau-compile" --binary -O2 -g2 "$FIXTURE/move-closure-loop.luau" \
  > /tmp/luau-move-lifetime/original-v14-O2.luauc
cmp "$FIXTURE/move-closure-loop-v14-O2.luauc" \
  /tmp/luau-move-lifetime/original-v14-O2.luauc

npm run build
node dist/cli.js disassemble "$FIXTURE/move-closure-loop-v9-O2.luauc"
node dist/cli.js decompile "$FIXTURE/move-closure-loop-v9-O2.luauc" \
  > /tmp/luau-move-lifetime/reconstructed.luau
/tmp/luau-move-lifetime/compile_api /tmp/luau-move-lifetime/reconstructed.luau 2 \
  /tmp/luau-move-lifetime/recompiled.luauc
/tmp/luau-move-lifetime/run_bytecode "$FIXTURE/move-closure-loop-v9-O2.luauc"
/tmp/luau-move-lifetime/run_bytecode /tmp/luau-move-lifetime/recompiled.luauc
npm test -- tests/closure-move-loop-lifetime.test.ts
```

The six saved originals were regenerated byte for byte during validation.

## Official and reference implementation review

Official Luau's [MOVE handler](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lvmexecute.cpp#L378-L386)
copies the value into the destination register. Later writes to the source
register cannot change that copy.
[CLOSEUPVALS](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lvmexecute.cpp#L474-L482)
closes open upvalues and does not assign to either register.

Tovek at `77edf387bf280a2f4d46d57ac85d5c4f071b763f` was inspected statically:
its [MOVE lifting](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/luau-lifter/src/lifter.rs#L626-L630)
initially retains the assignment, and
[copy cleanup](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/ast/src/copy_cleanup.rs#L79-L90)
checks later source writes and capture state before removing a copy. This is
supporting evidence for the lifetime invariant, not a measurement that Tovek
passes these inputs. Its MIT license was reviewed; no implementation was
copied. The fix uses AnnonyA's existing CFG entry-liveness proof and binding
ownership flags.
