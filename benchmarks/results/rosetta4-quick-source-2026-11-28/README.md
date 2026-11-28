# Rosetta 4: Quick and Hard Quick verification

- Rosetta: [ae7635c4](https://github.com/Scrensayol/rosetta/commit/ae7635c4e0e818d3cddd672c686dbacecbbeed64), Luau 0.747.
- Suite hashes: Quick `f99045656e5f7f14`; Hard Quick `820f50496ba24191`.
- LUVEX baseline: [64418477](https://github.com/AnnonyA/Luau-decompiler/commit/644184775a90712fe0fac4224a05e0f77e747da9), the numeric-loop exit fix. All runs use Node 24.22.3; defaults are unchanged.
- The source metric measures ordered token shapes, not exact names or text. It is averaged over behavior passes only. This does not replace any Rosetta 3 gate.

## Results

| LUVEX build and options | Quick behavior / calls | Quick source | Hard Quick behavior / calls | Hard Quick source |
| --- | ---: | ---: | ---: | ---: |
| Baseline, defaults unchanged | 888/888 / 888/888 | 79.2034% | 888/888 / 888/888 | 77.8962% |
| Compound update experiment (not shipped) | 888/888 / 888/888 | 79.1323% | 888/888 / 888/888 | 77.9738% |
| Baseline, `type_annotations=off` | 888/888 / 888/888 | **79.6144%** | 888/888 / 888/888 | **78.5101%** |

All configurations had zero refusals, compile failures and behavior
mismatches. Disabling synthetic type annotations improves both tiers
without changing the default annotated mode. This is a presentation
option, not recovery of erased source types. These two runs use a local
persistent worker calling the same `decompile` and `parseQueryOptions`
entry points as the CLI. Ignore the probe's CPU fields: process accounting
does not include the worker. The CLI commands below reproduce the option.
The experiment is not in the engine branch: it improves Hard Quick and
the authored probe but lowers the mean over the same 888 Quick passes.

## Experiment

Reconstruct `x //= rhs` and `x ^= rhs` when the assignment updates the same
direct identifier that the operation reads. Indexed destinations are left
unchanged: bases and keys would require a separate evaluation-order proof. Both
spellings are also supported by
[Tovek's formatter](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/formatter.rs#L24-L67).
The implementation extends LUVEX's own compound-assignment recovery. The
authored numeric-loop example passes all six official VM profiles in both
builds; its similarity improves from 77.29% to 83.61%.

## Why bytecode isn't a perfect source archive

The two `collision/` inputs, with `x += y` and `x = x + y`, have different
token shapes, but compile to byte-identical bytecode at **all six** profiles,
including debug level 2. A decompiler given only those bytes must emit the
same source shape for both. This is an example outside the scored corpus: it
rules out a universal guarantee of 100% source similarity, not any specific
upper bound on Rosetta's fixed set.

From a built checkout of the pinned Rosetta, set `R` to its release executable,
`B` to this results directory and `LUVEX` to the selected build's absolute
`dist/cli.js`. Then:

```sh
tmp=$(mktemp -d)
trap 'rm -r "$tmp"' EXIT
for profile in O0g1 O1g1 O2g1 O0g2 O1g2 O2g2; do
  "$R" compile "$B/collision/compound/case.luau" --profile "$profile" -o "$tmp/compound.luac"
  "$R" compile "$B/collision/expanded/case.luau" --profile "$profile" -o "$tmp/expanded.luac"
  cmp "$tmp/compound.luac" "$tmp/expanded.luac" || exit 1
done
for tier in quick hard-quick; do
  "$R" bench --tier "$tier" --decompiler "luvex=node $LUVEX decompile {}" \
    --decompiler "luvex-no-annotations=env LUAU_DECOMPILE_OPTS=type_annotations=off node $LUVEX decompile {}" \
    --gallery --out ./out
done
```
