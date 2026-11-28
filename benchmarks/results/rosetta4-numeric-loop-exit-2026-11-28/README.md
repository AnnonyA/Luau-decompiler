# Rosetta 4 Quick: numeric loop exit witness

Scope: Rosetta 4 Quick only. The existing Rosetta 3 gates, corpus and
published results are unchanged.

- Rosetta: [ae7635c4](https://github.com/Scrensayol/rosetta/commit/ae7635c4e0e818d3cddd672c686dbacecbbeed64), Luau 0.747, Quick suite hash `f99045656e5f7f14`.
- LUVEX baseline: [b5183ec0](https://github.com/AnnonyA/Luau-decompiler/commit/b5183ec015b3e7e5b377296ec87390a4957a09e6). Both LUVEX measurements used Node 24.22.3 and identical default CLI options.
- Tovek: [ce2ea332](https://github.com/Kiet1308/Tovek/tree/ce2ea3325547fa3896f274b68013386338039040), native default CLI, pinned nightly, `fastrel` profile. Not the separate Tovek row published by Rosetta.

## Measured Quick results

| Engine | Behavior | Same state-changing calls | Source similarity |
| --- | ---: | ---: | ---: |
| LUVEX baseline | 880/888 | 880/880 passes | 79.2139% |
| LUVEX with the exit fix | **888/888** | **888/888 passes** | 79.2034% |
| Tovek local | 867/888 | 867/867 passes | 84.2438% |

The candidate keeps every existing pass and fixes all eight mismatches,
with zero refusals and zero compile failures. Local Tovek had 20 refusals
and one mismatch. Tovek's source score is computed from a different pass set.
A separate named-member presentation experiment helped the new
`silent_effects` case but reduced the baseline Quick source mean on the same
880 passes (79.2139% to 79.1718%), so it is not in this patch.

## What failed

All eight baseline mismatches are pathfinding mutants at O2g2. The inlined
numeric loop has an entry test, a successful body that jumps to the shared
continuation, and a zero-trip fallback. Its FORNLOOP is unreachable. LUVEX
asked the dead latch for a post-dominator, rejected the true join, and
executed the fallback even when the loop body had supplied the table key.
The result attempted to store under a nil key instead of continuing.

[Tovek resolves a continuation from actual numeric-loop exit targets](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/restructure/src/region.rs#L2480-L2553);
it also passed these eight profiles under the same local runner. LUVEX applies
the invariant independently: for the existing synthetic numeric region with
an unreachable latch, use the reachable normal exit as the post-dominance
witness and keep the usual rule for reachable latches. Its existing
normal-tail and phi machinery then runs the fallback only on the right path.
No Tovek code was copied. The [Luau 0.747 VM](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/VM/src/lvmexecute.cpp#L2519-L2553)
confirms the distinction between successful entry and a skipped loop.

The authored fixture in `tests/fixtures/numeric-loop-exit-witness` exercises
successful and zero-trip cases with positive and negative steps, plus a NaN
bound, and checks the live key through a table write/read. Its full
official-VM matrix improves from 4/6 to 6/6; the eight frozen failing mutant
replays improve from 0/8 to 8/8. Tovek matches both focused matrices. The
baseline failures remain in the attached JSON. No postprocessing, case-name
checks or benchmark exclusions were introduced.

## Reproduce

Build the LUVEX checkout with `npm ci && npm run build`. From the pinned
Rosetta checkout, run:

```sh
cargo build --locked --release
./target/release/rosetta bench --tier quick \
  --decompiler 'luvex-loop-fix=node /absolute/path/to/luvex/dist/cli.js decompile {}' \
  --version luvex-loop-fix=reachable-numeric-for-exit --gallery --out ./out
./target/release/rosetta check /absolute/path/to/luvex/tests/fixtures/numeric-loop-exit-witness/inline-loop-exit.luau \
  --decompiler 'fixed=node /absolute/path/to/luvex/dist/cli.js decompile {}'
```

Use an independently built LUVEX checkout at `b5183ec0` for the baseline and
`tovek-local=/absolute/path/to/tovek/target/fastrel/luau-lifter {}` for Tovek.
Source similarity is averaged over each engine's passing rows; it is not a
paired quality ranking when the pass sets differ. Elapsed times are not
compared because the runs overlapped other work on the host.
