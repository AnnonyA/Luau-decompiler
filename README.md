# Luau decompiler

A TypeScript decompiler for official Luau bytecode. It never runs the input: it decodes the proto, rebuilds control flow, and prints Luau.

```
bytecode → decode → CFG → SSA → AST → printer
```

Versions **3–9** are the supported decode surface. 10–13 decode, but reconstruction of those extras is still incomplete.

## Usage

```bash
npx luau-decompile decompile chunk.luac
npx luau-decompile disassemble chunk.luac
```

```ts
import { decompile } from "luau-decompiler";

const result = decompile(bytes);
if (result.ok) console.log(result.source);
```

```
npm test && npm run typecheck && npm run build
```

## What it already does

The output is meant to read like someone wrote it. No raw registers, no `up0`, no invented comments.

- Compound assigns: `self.value += n`
- Methods: `function config:add(...)`
- Value `if`: `return if cond then a else b`, plus real `elseif` chains
- Loop structuring: `if i % 2 == 0 then continue`, `if value > 100 then break`, sequential continue-guards instead of a wrapping if
- Event handlers named from the signal: `onRenderStepped`, `onStopped`, `onActivated`
- Mutual recursion (`isEven` / `isOdd`) resolves instead of calling a ghost local
- Types only when we are sure (`Players: Players`) — never `: nil`

On the three real fixtures: **0** `rN`, **0** `upN`, **0** comment lines, **0** `: nil`.

## Roblox API names and types

Connect/Once/Observe handlers pick up the official argument names **and** types. Cases that used to stay as `value, index` now come out as real API:

```luau
local UserInputService = game:GetService("UserInputService")

UserInputService.InputBegan:Connect(function(input: InputObject, gameProcessedEvent: boolean)
    if gameProcessedEvent then
        return
    end

    print("Pressed:", input.KeyCode.Name)
end)
```

Same idea for `PlayerAdded` (`player: Player`), `Heartbeat` (`deltaTime: number`), `Touched` (`hit: BasePart`), `Completed` (`playbackState`), CameraShaker (`cframe: CFrame`), and the rest of the common signals.

## Runtime context (optional)

If you decompile from a live executor, you can dump in-game names and feed them back so the module is not just called `module`.

Run `scripts/collect-context.luau` (loadstring / executor). It prints JSON. Then:

```bash
npx luau-decompile decompile chunk.luac --context context.json
```

```luau
-- in-game
local module = {}
function module.Add(num1: number, num2: number) ... end
return module
```

```luau
-- with context { "moduleName": "AdditionModule" }
local AdditionModule = {}
function AdditionModule.Add(num1: number, num2: number) ... end
return AdditionModule
```

Leave `--context` out, or pass `--no-context` / `runtime_context=false`, and nothing is renamed.

## Versus other Luau decompilers

We already do better on types, method lifting, if-expressions, callback names, and region-based loop structuring (`break` / `continue` / sequential guards).

Everyday locals are closing: `LocalPlayer`, `sharedCounter`, `CONFIG`, `Counter`, `payload`, `descending`. Other decompilers still win on leftover `valueN` / `resultN` and exact source spellings (`HALF_SECOND`, `seed`).

## Still to do (to look like the original source)

1. Leftover numbered temps — `value108`, `result27` after callee-alias collapse
2. Exact source spellings we cannot prove (`HALF_SECOND`, `WHITE`, `UP`)
3. One `total` across a function instead of `total` / `total2` / `result8`
4. Parameter types on ordinary functions, not only Roblox callbacks

The bar is `tests/Original.txt`, not “good enough for a decompiler.”
