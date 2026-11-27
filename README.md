# Luau decompiler

A **static TypeScript decompiler for official Luau bytecode** that aims for readable, source-like Luau instead of a register dump.

It never executes the input. The pipeline decodes the bytecode, reconstructs control flow and values, lifts them into an AST, and prints Luau:

```text
bytecode → decode → CFG → SSA → AST → printer
```

| | |
| --- | --- |
| **Input** | Official Luau bytecode |
| **Output** | Readable Luau source |
| **Analysis** | Static-only; input is never executed |
| **Implementation** | TypeScript, Node.js 20+ |
| **Bytecode support** | Versions 3–9 reconstructed broadly; 10–14 have experimental decoding/reconstruction, including v14 `FASTPCALL` |
| **License** | MIT |

## Why this exists

A useful decompiler should recover program structure, not just rename registers. This project focuses on turning low-level bytecode patterns back into code that looks intentionally written while staying conservative when the original source cannot be proven.

That means recovering things such as:

- structured `if` / `elseif`, value-`if`, loops, `break`, and `continue`
- methods and closures instead of flat anonymous register operations
- useful local and callback names when there is enough evidence
- Roblox callback and helper types from the bundled Creator Hub API catalog
- tables, compound assignments, value packs, captures, and mutual recursion
- calls to retained numeric helpers expanded by O2, with exact expression and lexical-binding checks ([scope and limitations](docs/references/inline-recovery-performance.md))
- explicit uncertainty instead of invented source details

On the three real fixtures currently used by the project, the generated output contains **0 raw `rN` registers, 0 `upN` names, 0 invented comment lines, and 0 `: nil` annotations**.

## Rosetta 3 reconstruction results

**Complete measured results.** Quick **882/882**; Full **12,276/12,276**; Hard Quick **882/882**; Hard Full **12,276/12,276**. All four strict gates passed every usable original/profile pair. The measured engine uses one frozen source snapshot, published as [`08259cd6c312fe9c41eda0e0c5d0d03d9524cf71`](https://github.com/AnnonyA/Luau-decompiler/commit/08259cd6c312fe9c41eda0e0c5d0d03d9524cf71).

| Tier | AnnonyA | Luacid published result | lua.expert published result |
| --- | ---: | ---: | ---: |
| Quick | [882/882](benchmarks/results/rosetta-final-2026-11-27/annonyA-quick.json) | [879/882](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/luacid-quick.json) | [882/882](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/lua-expert-quick.json) |
| Full | [12,276/12,276](benchmarks/results/rosetta-final-2026-11-27/annonyA-full.json) | [12,237/12,276](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/luacid-full.json) | [12,167/12,276](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/lua-expert-full.json) |
| Hard Quick | [882/882](benchmarks/results/rosetta-final-2026-11-27/annonyA-hard-quick.json) | [353/882](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/luacid-hard-quick.json) | [264/882](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/lua-expert-hard-quick.json) |
| Hard Full | [12,276/12,276](benchmarks/results/rosetta-final-2026-11-27/annonyA-hard-full.json) | [5,622/12,276](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/luacid-hard-full.json) | [3,859/12,276](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/lua-expert-hard-full.json) |

See the [four-tier report and raw evidence](benchmarks/results/rosetta-final-2026-11-27/README.md) for the exact Quick, Full, Hard Quick and Hard Full counts, and [the engine changes](docs/references/rosetta-final-2026-11-27.md) for the reconstruction fixes and official-VM controls.

Against these published snapshots, AnnonyA exceeds Luacid in all four tiers. It ties lua.expert on Quick at 882/882 and exceeds it on Full, Hard Quick, and Hard Full. Full and Hard Full each retain six unusable upstream original/profile pairs outside their 12,276 graded pairs. These are finite-corpus accuracy results against the audited published competitor snapshots; no speed comparison is claimed. Quick and Hard Quick run as strict automatic CI gates.

## Quick start

### Browser demo

The static playground is published at
**[annonya.github.io/Luau-decompiler](https://annonya.github.io/Luau-decompiler/)**
when the repository's **Browser demo** deployment succeeds. Upload a binary
chunk (up to 16 MiB), paste Base64, or try the built-in example. The demo shows
source, disassembly and diagnostics, with copying and `.luau` downloads.
Processing happens in a cancellable browser worker; uploaded bytecode is never
sent to a server or executed. A 15-second timeout keeps problematic chunks
from running indefinitely. Bytecode support and reconstruction limitations
are the same as the engine; encrypted/compressed wrappers are not raw bytecode.

To run the static site locally:

```sh
npm ci
npm run build:demo
npm run demo:test
python3 -m http.server 8080 --directory _site
# Open http://localhost:8080 (do not open index.html as a file:// URL).
```

`npm run demo:test:browser` additionally checks the real worker and interface
in headless Chromium, including the repository subpath and mobile layout.
Install Chromium first, or set `CHROME_BIN` to a compatible Chrome executable.
CI uses the Chrome executable provided by the Ubuntu runner.

The site uses relative URLs, including worker imports, so it also works under
the repository's `/Luau-decompiler/` path. No new runtime dependencies or
backend service are required. The existing Node HTTP interface remains available.

The [Pages workflow](.github/workflows/pages.yml) builds and tests the site on
pull requests and publishes on `main`. For initial setup, an administrator must
select **Settings → Pages → Build and deployment → Source: GitHub Actions**,
then run the **Browser demo** workflow. GitHub's default workflow token cannot
enable Pages for the first time. Subsequent pushes publish automatically; no
custom domain or additional secret is required.

### CLI and library

```bash
git clone https://github.com/AnnonyA/Luau-decompiler.git
cd Luau-decompiler
npm install
npm run build
```

Decompile a chunk:

```bash
node dist/cli.js decompile chunk.luac
```

Disassemble without reconstructing source:

```bash
node dist/cli.js disassemble chunk.luac
```

The package also exposes a library API:

```ts
import { decompile } from "luau-decompiler";

const result = decompile(bytes);
if (result.ok) console.log(result.source);
```

The demo, CLI and HTTP exports prepend an AnnonyA header with the package
version, an ISO 8601 UTC timestamp, and the decoded bytecode/type versions.
Library `result.source` stays deterministic; use `formatDecompiledSource(result)`
to add the same export header. The header is included when copying or downloading
the demo result.

Luau string constants preserve arbitrary bytes, including a leading UTF-8 BOM.
Valid UTF-8 remains ordinary JavaScript text. Invalid UTF-8 bytes are represented
internally by unpaired surrogate escapes (`U+DC80`–`U+DCFF`) and printed as Luau
decimal byte escapes. Library consumers can use `encodeByteString(value)` to
recover the original bytes; plain `TextEncoder` would replace these escapes.

The controlled semantic corpus now contains **100 independent programs**,
checked under both O0 and O1: **200 mandatory behavior comparisons**. See the
[coverage catalog](benchmarks/semantic/README.md) for the cases and limitations.

A separate [three-engine benchmark](benchmarks/originals/README.md) compares
12 new originals against AnnonyA, LunaUX and Lua.Expert with identical official
O0/O1 bytecode, cached API responses and input-specific runtime traces. See its
[measured results and unresolved failures](benchmarks/results/competition-2026-10-21/README.md).
The `mathConstants` compatibility option now retains numeric literals: replacing
them with `math.pi` cannot preserve exact values and binding identity generally.

## What the output looks like

The goal is to produce normal Luau constructs rather than leaking VM details:

```luau
local UserInputService = game:GetService("UserInputService")

UserInputService.InputBegan:Connect(function(input: InputObject, gameProcessedEvent: boolean)
    if gameProcessedEvent then
        return
    end

    print("Pressed:", input.KeyCode.Name)
end)
```

Other recovered forms include:

```luau
self.value += n
```

```luau
function config:add(...)
```

```luau
return if condition then a else b
```

and loop regions with real `break` / `continue` instead of flattened jumps.

## Reconstruction highlights

- Compound assignments such as `self.value += n`
- Method lifting such as `function config:add(...)`
- Value `if` and real `elseif` chains
- Region-based loop structuring with `break`, `continue`, and sequential guards
- Event handlers named from their signal, including `onRenderStepped`, `onStopped`, and `onActivated`
- Mutual recursion recovery (`isEven` / `isOdd`) without ghost locals
- Conservative type recovery — never emitting a type just because a slot happened to contain `nil`
- Local and parameter names from evidence: the class or child an initializer names (`sound`, `screenGui`, `humanoid`), the field or API slot a value fills (`name`, `soundId`, `tweenInfo`, `callback`), and how a parameter is used (`instance`, `player`, `list`); neutral `p` / `value` names numbered per function when nothing is known
- REF capture recovery for nested closures instead of unresolved callback placeholders

## Roblox API names and types

The browser and CLI use an offline catalog generated from a pinned Roblox
Creator Hub snapshot. Both resolve inherited members using the type of the
receiver. For example, `UserInputService.InputBegan` provides an `InputObject`
and a `boolean`. The `InputBegan` inherited by a `TextButton` provides only
the `InputObject`. A custom table can use the same event name without acquiring
either signature.

For example, if a `PlayerAdded` callback passes its argument to a local
`formatName` helper that returns `p.DisplayName`, the CLI and browser can
recover `function formatName(p: Player): string`. The helper's calls must
agree on the type. If the helper escapes or optimization removes the call,
its parameter stays unannotated. The same analysis uses known arguments from
`Connect`, `Once`, `ConnectParallel`, and engine callback assignments.
A remote event's fixed `Player` argument can be typed even when the rest of
its payload is unknown. [API facts and sources](docs/references/roblox-callback-types.md)

On the [cross-service fixture](tests/fixtures/rewrites/roblox-service-signatures.luau)
compiled at O0, O1 and O2, the previous revision (`feccabf`) recovered 9 of
38 justified parameter and return annotations and annotated 12 of 25 unknown
slots. The generated catalog and receiver analysis recover all 38 and leave
all 25 unknown slots unannotated. The original and all nine reconstructions
produced the same trace under the official Luau VM with simulated services.

## Local naming options

The web decompiler supports readable or compact local names and optional
`camelCase`, `snake_case`, or `PascalCase`. Renaming follows lexical bindings,
including captured variables and shadowed parameters. Public table keys, globals,
method names, implicit `self`, and identifiers mentioned in opaque type annotations
keep their spelling. Compact mode takes precedence over casing.

```js
decompile(bytes, { generatedNames: "readable", nameCasing: "snake_case" });
```

The HTTP parameters are `generated_names` and `name_casing`; the CLI accepts them
through `LUAU_DECOMPILE_OPTS`:

```bash
LUAU_DECOMPILE_OPTS='generated_names=compact' node dist/cli.js decompile chunk.luac
```

Check all five naming configurations against the existing reduced originals:

```bash
npm run bench:large:regressions -- --name-styles \
  --luau-compile /path/to/luau-compile --luau /path/to/luau --output /tmp/naming-results
```

## Rewrite controls

The browser exposes all 14 controls below. JavaScript accepts the camelCase
option; HTTP and `LUAU_DECOMPILE_OPTS` use its snake_case spelling.

| Control / JavaScript option | Default | Supported transformation |
| --- | --- | --- |
| Interpolated strings / `interpolatedStrings` | On (browser: off) | Proven string concatenation/format patterns, with byte-preserving escapes |
| Math constants / `mathConstants` | Off | Repeated exact constants get private numeric locals; no global `math` lookup |
| If-expressions / `ifExpressions` | On | Eligible branch values become Luau if-expressions |
| Early continue / `earlyContinue` | On | Eligible loop guards become early continues |
| Early return / `earlyReturn` | On | Eligible terminal guards become early returns |
| Uninline local functions / `recoverInlinedFunctions` | On | Proven calls to retained helpers, including fixed tuples of 2–4 primitive results |
| Reroll unrolled loops / `rerollUnrolledLoops` | Off | At least three proven numeric updates with an integer unit stride |
| Fold single-use temps / `foldSingleUseTemps` | On | Safe temporary/argument folding; minimum register-pressure compaction remains mandatory |
| Unfold module tables / `unfoldModuleTables` | On | Exported helpers and inert named module fields, preserving initializer captures |
| Keep dead functions / `keepDeadFunctions` | On | Turning off removes only proven unreferenced private functions |
| Prefer const / `preferConst` | Off | Immutable initialized bindings use recent Luau `const` syntax |
| Unicode strings / `unicodeStrings` | On | Turning off emits exact UTF-8 byte escapes, including interpolation |
| Upvalue comments / `upvalueComments` | Off | Lists actual lexical captures, including forwarded captures |
| Function line comments / `functionLineComments` | Off | Emits known bytecode definition lines |

Controls preserve required control flow and effects. They cannot restore functions,
loops, names or comments erased without usable evidence by the compiler. Inlining
recovery rejects unknown effects, ambiguous helpers, clipped tuples and insufficient
local-register headroom. Rerolling does not infer arbitrary loop bodies. `const`
requires a Luau parser that supports this recent syntax; it is opt-in.

Run the original-source semantic matrix at O0/O1/O2 with defaults, each individual
inverse and both all-on/all-off combinations (17 configurations; not exhaustive):

```bash
npm run bench:large:regressions -- --rewrite-options \
  --luau-compile /path/to/luau-compile --luau /path/to/luau --output /tmp/rewrite-results
```

## Optional runtime context

Static bytecode cannot always preserve source-level names. If you have runtime context from a live environment, it can be supplied separately to improve names without changing the core decompiler into a dynamic executor.

Run `scripts/collect-context.luau` to produce JSON, then pass it to the CLI:

```bash
node dist/cli.js decompile chunk.luac --context context.json
```

For example, context can turn a generic returned `module` table into a known module name such as `AdditionModule`.

Leave `--context` out, pass `--no-context`, or use `runtime_context=false` to keep the decompilation purely bytecode-derived.

## Architecture

The implementation is split around the information recovered at each stage:

```text
validated bytecode
      ↓
version-aware decoder
      ↓
control-flow graph
      ↓
SSA / phi reconstruction
      ↓
structured regions + value semantics
      ↓
Luau AST
      ↓
source printer
```

The important rule is that later stages only claim structure the earlier analysis can justify. When reconstruction is uncertain, the project prefers a conservative representation over fabricating an exact original spelling.

## Current limitations

The target is source-like output, not an assertion that lost source information can always be recovered exactly.

Current gaps include:

1. leftover numbered temporaries when a register is reused for unrelated values
2. exact source spellings that are absent from bytecode (`HALF_SECOND`, `WHITE`, `UP`, etc.)
3. parameter and return types for helpers reached through dynamic calls, generic functions, and Roblox members outside the offline catalog
4. a few upvalue slots that can still inherit the same inferred name
5. incomplete high-level reconstruction for bytecode versions 10–14, especially class and feedback extensions

The project uses `tests/Original.txt` as the quality bar where an original fixture is available, rather than treating syntactically valid output as sufficient.

Bytecode v14 recognizes the official `FASTPCALL` optimization and reconstructs through its accompanying ordinary `CALL` fallback. This does **not** mean the original names, optimizations, experimental class semantics, or all runtime details can be recovered. The version 10–14 profile remains experimental until it has sufficient real-world fixtures.

## Development

```bash
npm test
npm run typecheck
npm run build
```

Contributions that improve semantic reconstruction, reduce false-positive naming, add bytecode-version coverage, or provide small reproducible fixtures are especially useful.

If you find a case that reconstructs incorrectly, open an issue with the smallest bytecode/source example you can share and the output you expected.

## Evidence across functions and semantic fuzzing

The reconstruction pipeline can infer parameter names from consistent direct
call sites and recognized method usage. Primitive parameter types require a
complete set of direct calls; escaped/reassigned functions, mutable parameters,
unknown arguments and open packs remain unannotated by this analysis. Conflicting
known primitive inputs produce unions. Fixed returns propagate through local
call chains with a bounded fixed point; fallthrough and unknown packs stay broad.
This pass does not move evaluations or rebuild compiler-eliminated functions.

```bash
npm run bench:fuzz -- --count 30 --seed 1 --reduce-attempts 20 \
  --luau-compile /path/to/luau-compile --luau /path/to/luau --output /tmp/fuzz-results
```

The generator exercises mutable captures, aliases, ordered effects, loops and
multiple returns. Failures retain sources, exact bytes, hashes and traces.
The bounded reducer accepts smaller sources only when their originals execute
successfully and the same failure category remains. Timeouts and invalid
originals are not semantic mismatches. Generated variants share a grammar;
their count does not measure independent architecture coverage.

The [independent corpus report](benchmarks/results/independent-2026-10-27/README.md)
preserves the first competitive measurement separately from later regression
results. The [Tovek reference note](docs/references/tovek-capture-reconstruction.md)
explains the capture invariant used in our SSA reconstruction fix.
