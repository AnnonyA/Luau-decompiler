# Luau Decompiler

A static TypeScript decompiler that turns official Luau bytecode into readable
Luau source. It reconstructs program structure without executing the input.

**[Open LUVEX in your browser](https://annonya.github.io/Luau-decompiler/)** ·
[Usage guide](docs/usage.md) · [Version history](CHANGELOG.md)

**LUVEX** is the browser interface for this engine. The repository is
`Luau-decompiler`, the Node package is `luau-decompiler`, and the executable is
`luau-decompile`.

## What it does

- Reconstructs conditions, loops, methods, closures, tables and multiple returns.
- Recovers names and useful types from available evidence, including an offline
  Roblox API catalog.
- Provides source, disassembly and diagnostics through the browser, CLI, library
  and HTTP API.

In LUVEX, upload a bytecode file, paste Base64 or try the built-in example.
Processing runs in a cancellable browser worker; uploaded bytecode stays in your
browser. The current limits are **16 MiB** per input and **15 seconds** per run.

## Rosetta 3 results

The measured engine passed **100% of usable source/profile pairs in all four
tiers** on 2026-11-27, using the pinned Rosetta 3 corpus and default options.

| Tier | Behavioral pass | Source similarity | Output/original tokens |
| --- | ---: | ---: | ---: |
| Quick | 882/882 | **76.93%** | 99.27% |
| Full | 12,276/12,276 | **73.91%** | 87.55% |
| Hard Quick | 882/882 | **76.39%** | 99.79% |
| Hard Full | 12,276/12,276 | **73.53%** | 87.72% |

Full and Hard Full each execute 12,282 pairs. The six profiles of the unusable
upstream original `generated/seed1541` remain outside each graded denominator.
No other originals are excluded. These are finite-corpus results.

A behavioral pass does not imply identical source. Token ratios describe
normalized tokens, not file size.

[Complete report and raw evidence](benchmarks/results/rosetta-source-similarity-2026-11-27/README.md) ·
[Published-result comparison](benchmarks/results/rosetta-source-similarity-2026-11-27/comparison.md) ·
[Reproduce the measurements](docs/benchmarks/rosetta.md)

## Quick start

Requires **Node.js 20 or newer** and npm. CI checks Node 20 and 22.

```sh
git clone https://github.com/AnnonyA/Luau-decompiler.git
cd Luau-decompiler
npm ci
npm run build
```

## CLI

Run these commands from the checkout after building. Replace `chunk.luac` with
your bytecode file:

```sh
node dist/cli.js decompile chunk.luac > chunk.luau
node dist/cli.js disassemble chunk.luac
node dist/cli.js info chunk.luac
```

For a local HTTP API, run `node dist/cli.js serve 3000`.
[CLI options, HTTP requests and runtime context](docs/usage.md) are documented in
the usage guide.

## JavaScript / TypeScript

From the built checkout:

```js
import { readFileSync } from "node:fs";
import { decompile } from "./dist/index.js";

const result = decompile(readFileSync("chunk.luac"));
if (!result.ok) throw new Error(result.error);
console.log(result.source);
```

The result also includes diagnostics, disassembly and the bytecode profile.
See the [library guide](docs/usage.md#javascript--typescript) for options and
export formatting.

## Support and limits

Bytecode versions **3–9** have broad reconstruction support. Versions **10–14**
are experimental, with incomplete class and feedback support. Read the returned
diagnostics; compiler-erased names, comments and source structure may be
unrecoverable. [Detailed limitations](docs/usage.md#supported-inputs-and-limitations)

## Development

```sh
npm test
npm run typecheck
npm run build
```

[Development guide](docs/development.md): local LUVEX builds, browser checks,
architecture, semantic tests and contribution requirements.

## Documentation and history

| Guide | Contents |
| --- | --- |
| [Usage](docs/usage.md) | CLI, library, HTTP API, names, types and rewrite controls |
| [Development](docs/development.md) | Local demo, architecture, CI and test workflows |
| [Rosetta methodology](docs/benchmarks/rosetta.md) | Corpus pins, strict gates and reproduction |
| [Benchmark catalog](benchmarks/README.md) | Other corpora, runtime comparisons and reports |
| [Engineering notes](docs/references/rosetta-source-similarity-2026-11-27.md) | Reconstruction changes and remaining work |
| [Changelog](CHANGELOG.md) | Recorded package version and dated development milestones |

The package version is **0.2.0**. The changelog distinguishes package history
from releases and benchmark targets. License: **MIT**.
