# Development guide

[Back to the README](../README.md) · [Usage and options](usage.md)

## Build and test

Use Node.js 20 or newer. Required CI covers Node 20 and 22.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run bench:test
```

Follow [AGENTS.md](../AGENTS.md). Reconstruction changes require relevant
compiler/VM and pinned Tovek references, small reproductions, and checks of
capture identity, effect order and return arity. Preserve sealed originals,
bytecode, first failures and cached external results. Required Node, official
parser/runtime and demo CI must pass before merging.

## Run LUVEX locally

The static interface is built from [`web/`](../web/). From the repository root:

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

The [Pages workflow](../.github/workflows/pages.yml) builds and tests the site on
pull requests and publishes on `main`. For initial setup, an administrator must
select **Settings → Pages → Build and deployment → Source: GitHub Actions**,
then run the **Browser demo** workflow. GitHub's default workflow token cannot
enable Pages for the first time. Subsequent pushes publish automatically; no
custom domain or additional secret is required.

## Architecture

The engine decodes validated bytecode, builds a control-flow graph, reconstructs
SSA values and phi joins, recovers structured regions and value semantics,
creates a Luau AST, then prints source.

| Stage | Implementation |
| --- | --- |
| Version-aware decoding and normalization | [`src/decode/`](../src/decode/) |
| Control-flow analysis | [`src/cfg/`](../src/cfg/) |
| SSA and liveness | [`src/ssa/`](../src/ssa/), [`src/dataflow/`](../src/dataflow/) |
| Regions, captures, names and types | [`src/reconstruct/`](../src/reconstruct/) |
| AST cleanup and validation | [`src/ast/`](../src/ast/) |
| Source presentation | [`src/print/`](../src/print/) |

Later stages should claim only structure supported by earlier analysis. Numeric
O2 helper recovery is bounded by expression, argument, binding and effect checks.
See the [inline-recovery scope](references/inline-recovery-performance.md),
[capture invariant](references/tovek-capture-reconstruction.md) and
[source-similarity changes](references/rosetta-source-similarity-2026-11-27.md).

### Reconstruction highlights

- Compound assignments such as `self.value += n`
- Method lifting such as `function config:add(...)`
- Value `if` and real `elseif` chains
- Region-based loop structuring with `break`, `continue`, and sequential guards
- Event handlers named from their signal, including `onRenderStepped`, `onStopped`, and `onActivated`
- Mutual recursion recovery (`isEven` / `isOdd`) without ghost locals
- Conservative type recovery — never emitting a type just because a slot happened to contain `nil`
- Local and parameter names from evidence: the class or child an initializer names (`sound`, `screenGui`, `humanoid`), the field or API slot a value fills (`name`, `soundId`, `tweenInfo`, `callback`), and how a parameter is used (`instance`, `player`, `list`); neutral `p` / `value` names numbered per function when nothing is known
- REF capture recovery for nested closures instead of unresolved callback placeholders

## Benchmarks and evidence

The [benchmark catalog](../benchmarks/README.md) documents commands, report
formats, corpus pins and interpretation. The engine itself is static; semantic
harnesses execute controlled originals and reconstructions in the official
Luau VM to compare behavior.

Start with the three checked-in bytecode fixtures:

```sh
npm run bench:compare -- --output /tmp/luau-baseline.json
```

That smoke test measures decompilation and output structure. Official syntax
validation requires an explicit pinned compiler; semantic equivalence requires
the runtime harness. A successful decompilation alone does not establish both.

Useful evidence entry points:

- [Rosetta reproduction](benchmarks/rosetta.md) and the
  [four-tier source-similarity report](../benchmarks/results/rosetta-source-similarity-2026-11-27/README.md).
  Strict Quick and Hard Quick are automatic CI gates. Full and Hard Full retain
  the six fixed unusable original/profile pairs; validators reject other exclusions.
- [Controlled semantic corpus](../benchmarks/semantic/README.md): 100 independent
  programs, checked at O0 and O1 for 200 mandatory behavior comparisons.
- [Three-engine originals](../benchmarks/originals/README.md) and their
  [first measured results](../benchmarks/results/competition-2026-10-21/README.md):
  12 new originals, identical official O0/O1 bytecode and cached API responses.
- [Independent corpus report](../benchmarks/results/independent-2026-10-27/README.md),
  which preserves first competitive measurements separately from later regressions.
- [Large-system cohorts](../benchmarks/large/README.md),
  [closure-identity corpus](../benchmarks/closure-identity/README.md) and
  [game-system lifetimes](../benchmarks/game-systems/README.md).

Published competitor similarity averages may cover different passing subsets.
Use the [population-aware comparison](../benchmarks/results/rosetta-source-similarity-2026-11-27/comparison.md)
before making ranking claims. Keep measured failures and refusals visible.

## Naming and rewrite matrices

Check all five naming configurations against the existing reduced originals:

```bash
npm run bench:large:regressions -- --name-styles \
  --luau-compile /path/to/luau-compile --luau /path/to/luau --output /tmp/naming-results
```

Run the original-source semantic matrix at O0/O1/O2 with defaults, each individual
inverse and both all-on/all-off combinations (17 configurations; not exhaustive):

```bash
npm run bench:large:regressions -- --rewrite-options \
  --luau-compile /path/to/luau-compile --luau /path/to/luau --output /tmp/rewrite-results
```

## Semantic fuzzing

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

The [independent corpus report](../benchmarks/results/independent-2026-10-27/README.md)
preserves the first competitive measurement separately from later regression
results. The [Tovek reference note](references/tovek-capture-reconstruction.md)
explains the capture invariant used in our SSA reconstruction fix.

## Contributing

Useful changes improve semantic reconstruction, reduce false-positive naming,
extend bytecode coverage or supply small reproducible fixtures. Follow original
source where available; [`tests/Original.txt`](../tests/Original.txt) is one
existing quality reference. Preserve behavior when shortening output.

For an incorrect reconstruction, open an issue with the smallest source/bytecode
pair you can share, compilation options, diagnostics and expected behavior.
Record the first failure before making it a development regression.
