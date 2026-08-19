# Luau decompiler

A TypeScript decompiler for official Luau bytecode (serialized proto format used by `luau_load`).

Bytecode versions **3–9** are treated as the current verified decode surface. Versions **10–13** and the experimental class version are decoded with extra fields preserved, but reconstruction of those extensions is incomplete.

The pipeline is:

```
bytecode → validated decode → CFG → dominators / SSA → structure → AST → printer
```

The decompiler never executes input. Malformed blobs fail with a `BytecodeError` instead of desynchronizing the instruction stream.

## Usage

```ts
import { decompile, decodeBytecode } from "luau-decompiler";

const result = decompile(bytes);
if (result.ok) {
  console.log(result.source);
}
```

```
npx luau-decompile decompile chunk.luac
npx luau-decompile disassemble chunk.luac
```

## Development

```
npm install
npm test
npm run typecheck
npm run build
```

Decoder tests construct official-format blobs with the in-repo writer. Semantic reconstruction is covered with explicit instruction fixtures rather than guessed opcode layouts.
