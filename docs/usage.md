# Usage guide

[Back to the README](../README.md)

Luau Decompiler statically reconstructs official Luau bytecode. **LUVEX** is its
browser interface; the package and executable are `luau-decompiler` and
`luau-decompile`.

## Build the checkout

Use Node.js 20 or newer and npm. From the repository root:

```sh
npm ci
npm run build
```

Examples below assume this working directory and a file named `chunk.luac`.
For an included bytecode input, use `tests/luac.bin`.

## LUVEX browser demo

Open [LUVEX](https://annonya.github.io/Luau-decompiler/), upload a binary chunk,
paste Base64 or load the built-in example. The interface displays source,
disassembly and diagnostics, with copying and `.luau` downloads.

Processing runs in a cancellable browser worker. Uploaded bytecode is not sent
to a server or executed. Inputs are limited to 16 MiB and each run has a
15-second timeout. The page loads its application assets and example over HTTP;
the browser and CLI share the same engine limitations.

See [local demo development](development.md#run-luvex-locally) to serve the site
from your checkout.

## CLI

```sh
# Reconstruct source; shell redirection saves it to a file.
node dist/cli.js decompile chunk.luac > chunk.luau

# Inspect instructions without source reconstruction.
node dist/cli.js disassemble chunk.luac

# Show bytecode/type versions, support status and prototype count.
node dist/cli.js info chunk.luac
```

The package executable is `luau-decompile`. When this built checkout is installed
as a dependency, that executable accepts the same commands. The CLI writes
failures to stderr and exits nonzero on a failed decompilation or error diagnostic.

Use URL query syntax for options:

```sh
LUAU_DECOMPILE_OPTS='generated_names=compact&if_expressions=false' \
  node dist/cli.js decompile chunk.luac
```

## JavaScript / TypeScript

Import from the built checkout, or use `luau-decompiler` as the import specifier
when the checkout is installed as a dependency:

```js
import { readFileSync } from "node:fs";
import { decompile, formatDecompiledSource } from "./dist/index.js";

const result = decompile(readFileSync("chunk.luac"), {
  generatedNames: "readable",
  typeAnnotations: "useful",
});

if (!result.ok) throw new Error(result.error);
console.log(result.source);
console.error(result.diagnostics);

const exportedSource = formatDecompiledSource(result);
```

`decompile` accepts a `Uint8Array` or `ArrayBuffer`. A successful result includes
`source`, `disassembly`, `diagnostics`, `profile`, `module`, `ast` and `validation`.
A failed result includes `error`, `code` and `diagnostics`. Inspect diagnostics
when assessing a reconstruction.

## Export headers and byte strings

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

## HTTP API

Start the Node server:

```sh
node dist/cli.js serve 3000
```

It listens on `0.0.0.0`. The default port is 3000, or `PORT` when no command-line
port is supplied. `GET /` serves the Node interface. Send raw bytes to
`POST /decompile` or its alias `POST /luau/decompile`:

```sh
curl --fail-with-body \
  -H 'Content-Type: application/octet-stream' \
  --data-binary @chunk.luac \
  http://localhost:3000/decompile
```

The default response is JSON containing `ok`, `source`, `disassembly`,
`diagnostics` and `profile`. For source text, use both the query parameter and
the `Accept` header:

```sh
curl --fail-with-body \
  -H 'Content-Type: application/octet-stream' \
  -H 'Accept: text/plain' \
  --data-binary @chunk.luac \
  'http://localhost:3000/decompile?format=source&generated_names=compact'
```

`Content-Type: text/plain` and `application/base64` select Base64 input.
Options use snake_case query parameters. Invalid requests return HTTP 400;
oversized request bodies return HTTP 413. The hosted static demo uses its
browser worker rather than this Node endpoint.

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

The `mathConstants` compatibility option preserves exact numeric literals.
Replacing them with a `math.pi` lookup would also change binding assumptions.

## Types and Roblox callbacks

`typeAnnotations` accepts `"off"`, `"functions"` or `"useful"` (the default).
The HTTP/CLI query spelling is `type_annotations`.

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
its payload is unknown. [API facts and sources](references/roblox-callback-types.md)

On the [cross-service fixture](../tests/fixtures/rewrites/roblox-service-signatures.luau)
compiled at O0, O1 and O2, the previous revision (`feccabf`) recovered 9 of
38 justified parameter and return annotations and annotated 12 of 25 unknown
slots. The generated catalog and receiver analysis recover all 38 and leave
all 25 unknown slots unannotated. The original and all nine reconstructions
produced the same trace under the official Luau VM with simulated services.

The reconstruction pipeline can infer parameter names from consistent direct
call sites and recognized method usage. Primitive parameter types require a
complete set of direct calls; escaped/reassigned functions, mutable parameters,
unknown arguments and open packs remain unannotated by this analysis. Conflicting
known primitive inputs produce unions. Fixed returns propagate through local
call chains with a bounded fixed point; fallthrough and unknown packs stay broad.
This pass does not move evaluations or rebuild compiler-eliminated functions.

## Optional runtime context

Static bytecode cannot always preserve source-level names. If you have runtime context from a live environment, it can be supplied separately to improve names without changing the core decompiler into a dynamic executor.

Run `scripts/collect-context.luau` to produce JSON, then pass it to the CLI:

```bash
node dist/cli.js decompile chunk.luac --context context.json
```

For example, context can turn a generic returned `module` table into a known module name such as `AdditionModule`.

Leave `--context` out, pass `--no-context`, or use `runtime_context=false` to keep the decompilation purely bytecode-derived.

## Reconstructed forms

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

## Supported inputs and limitations

The input is official Luau bytecode. Encrypted or compressed wrappers must be
handled separately. Versions 3–9 have broad reconstruction support; versions
10–14 are experimental. Class instructions may be decoded for inspection but
are rejected where source reconstruction is not implemented.

The target is source-like output, not an assertion that lost source information can always be recovered exactly.

Current gaps include:

1. leftover numbered temporaries when a register is reused for unrelated values
2. exact source spellings that are absent from bytecode (`HALF_SECOND`, `WHITE`, `UP`, etc.)
3. parameter and return types for helpers reached through dynamic calls, generic functions, and Roblox members outside the offline catalog
4. a few upvalue slots that can still inherit the same inferred name
5. incomplete high-level reconstruction for bytecode versions 10–14, especially class and feedback extensions

The project uses `tests/Original.txt` as the quality bar where an original fixture is available, rather than treating syntactically valid output as sufficient.

Bytecode v14 recognizes the official `FASTPCALL` optimization and reconstructs through its accompanying ordinary `CALL` fallback. This does **not** mean the original names, optimizations, experimental class semantics, or all runtime details can be recovered. The version 10–14 profile remains experimental until it has sufficient real-world fixtures.

See the [Rosetta report](../benchmarks/results/rosetta-source-similarity-2026-11-27/README.md)
and [source-recoverability evidence](../benchmarks/results/source-recoverability-2026-11-27/README.md)
for measured limits.
