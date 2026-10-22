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
- Roblox callback parameter names and types for common signals
- tables, compound assignments, value packs, captures, and mutual recursion
- explicit uncertainty instead of invented source details

On the three real fixtures currently used by the project, the generated output contains **0 raw `rN` registers, 0 `upN` names, 0 invented comment lines, and 0 `: nil` annotations**.

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
- Human-oriented local naming such as `LocalPlayer`, `sharedCounter`, `CONFIG`, `payload`, `seed`, `limit`, `total`, and `calls`
- REF capture recovery for nested closures instead of unresolved callback placeholders

## Roblox API names and types

`Connect`, `Once`, and `Observe` callbacks can pick up official argument names and types for common APIs. Examples include:

- `InputBegan` → `input: InputObject, gameProcessedEvent: boolean`
- `PlayerAdded` → `player: Player`
- `Heartbeat` → `deltaTime: number`
- `Touched` → `hit: BasePart`
- `CameraShaker` callbacks → `cframe: CFrame`

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
3. parameter types on ordinary functions beyond the callback cases that can be inferred confidently
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
