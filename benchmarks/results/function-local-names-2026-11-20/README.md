# Function names in independent sibling factories

This project-authored development regression creates two closures named `decode`. They capture different immutable arguments and different mutable counters. The program observes both prototype names with `debug.info(fn, "n")`, compares closure identities and invokes each closure repeatedly through direct and aliased references. Each call prints all three return values.

| Build | Optimization | Styles | Parsed sources | Complete VM traces matching the original |
| --- | --- | --- | --- | --- |
| PR #75, `6618c16b8cf9dc6190c0676e75fcd598f665f087` | O0, O1, O2 | 5 per level | 15/15 | 0/45 |
| Function-local allocation | O0, O1, O2 | 5 per level | 15/15 | 45/45 |

At baseline, all 45 traces printed `decode` and `decode2`. The original printed `decode` twice. Every subsequent line, including the identity checks, counters and return values, already matched. Both siblings have genuine prototype names in the input bytecode. O1 and O2 produced byte-identical inputs for this program.

The updated build printed `decode` for both closures in every run. The final focused fixture suite passed 24/24, including the raw reconstruction and capture-binding checks. The initial 22-test version passed one test and failed 21 on the clean PR #75 sources.

| Artifact | SHA-256 |
| --- | --- |
| [Baseline capture](before.json.gz) | `cb031c47518e55d70a7070cd5e755cacfc490057084967f11d6671346af43a2a` |
| [Updated capture](after.json.gz) | `729cf22b44f173fc523a3e806a57494b90bbc8329660601fc4adabbe0a1f02cc` |
| Fixture source | `9b27a871ba964376f8f666ec6ccdbcef245deb3084cfbaaeb9d3c8bdac1dd32a` |
| O0 bytecode | `baaa2b8aef98d7102364b6b83ad036c15727ea2d2a156872c396370463de1fb7` |
| O1 and O2 bytecode | `a58dbf84e6abeda9b3d07f444f576de23401ad492e65f16a4a3d795b0bd92b35` |

## Evidence and reproduction

The gzip files contain JSON with each original VM trace, official disassembly, raw reconstructed AST, final AST and source for each style, parser status, generated VM traces and their exact comparison outcomes. Each capture checks the compiler's binary stdout against the checked-in fixture. Trace comparison normalizes CRLF to LF. The only inputs are `-2`, `0` and `7`. The styles are default, compact, camelCase, snake_case and PascalCase. All compilation and VM invocations use the selected optimization level and debug level 1. [Fixture](../../../tests/fixtures/rewrites/sibling-function-names.luau) · [Input matrix](../../../tests/fixtures/rewrites/inputs.json) · [Capture script](capture.mjs)

With the evidence and fixtures in the current checkout, build PR #75 separately in a sibling directory. Run the following at the current repository root using the compiler and runtime from [official Luau 0.743](https://github.com/luau-lang/luau/releases/tag/0.743). The example uses the Windows distribution.

```powershell
git worktree add --detach ../function-names-before 6618c16b8cf9dc6190c0676e75fcd598f665f087
npm --prefix ../function-names-before ci
npm --prefix ../function-names-before run build
npm ci
npm run build
$capture = 'benchmarks/results/function-local-names-2026-11-20/capture.mjs'
$luauc = '../toolchain/luau-0.743/luau-compile.exe'
$luau = '../toolchain/luau-0.743/luau.exe'
node $capture ../function-names-before/dist $luauc $luau before-replay.json.gz
node $capture dist $luauc $luau after-replay.json.gz
```

## References and license

Tovek V2.7 scopes name reservations to active lexical regions. Its sibling-closure test permits separate locals to share a base spelling, and its refinement tests protect references to captures and globals. The self-capture check uses binding identity. These invariants informed the independent TypeScript implementation. Tovek's MIT license credits Jujhar Singh and Mathias Pedersen (2024). The comparison corpus remains pinned at `77edf387bf280a2f4d46d57ac85d5c4f071b763f`. [Local allocation](https://github.com/Kiet1308/Tovek/blob/a70720174f61028af9e38e8f6761d18c422c0bc7/ast/src/name_locals.rs#L5646) · [Sibling regression](https://github.com/Kiet1308/Tovek/blob/a70720174f61028af9e38e8f6761d18c422c0bc7/ast/src/name_locals.rs#L7591) · [Captured references](https://github.com/Kiet1308/Tovek/blob/a70720174f61028af9e38e8f6761d18c422c0bc7/ast/src/refine_names.rs#L2669) · [Self-capture](https://github.com/Kiet1308/Tovek/blob/a70720174f61028af9e38e8f6761d18c422c0bc7/ast/src/closure_identity.rs#L201) · [MIT license](https://github.com/Kiet1308/Tovek/blob/a70720174f61028af9e38e8f6761d18c422c0bc7/LICENSE.txt)

The official Luau compiler records the prototype's debug name. The runtime returns that name for the `n` option of `debug.info`. VAL, REF and UPVAL have separate capture operations in the VM. [Compiler](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/Compiler.cpp#L579) · [Debug library](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/ldblib.cpp#L90) · [NEWCLOSURE](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lvmexecute.cpp#L877)

## Captured argument and implicit method receiver

A second authored fixture installs `function record:read()` inside `setSelf`. Its method returns the outer numeric argument and `self.tag`. PR #75 inferred `self` for the outer argument, changing the first result from the number to the receiver table at O0 and O1. The original and reconstructed traces matched at O2. With the fix all nine combinations of three inputs and three optimization levels return `number`, `true`, `72`. [Before](receiver-before.json) · [After](receiver-after.json) · [Fixture](../../../tests/fixtures/rewrites/captured-method-receiver.luau)

The standard `bench:large:regressions --name-styles` and `--rewrite-options` runs include both fixtures with inputs from the rewrite input matrix. Ordinary debug locals can still receive suffixes when a protected prototype name appears elsewhere in the module.
