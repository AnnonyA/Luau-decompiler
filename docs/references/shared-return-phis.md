# Defined incoming values after a returning guard

This extends the bounded continuation proof documented in
`shared-return-conditions.md`. It uses the same pinned Tovek and official Luau
references and is independently implemented in the existing TypeScript CFG/SSA.

The first proof excluded all incoming phis and all `CLOSEUPVALS`. That preserved
the large repeated library body after a common loader idiom: an existing
library can return early, while either a registration call or a fresh table
supplies the library that the common initialization uses.

Two additional cases now have explicit proofs:

1. An incoming phi is accepted only when every reachable immediate predecessor
   belongs to one of the two proven, disjoint, acyclic arms and explicitly
   defines every phi register in that predecessor. Writes to other registers
   live at the join remain excluded. The existing phi declaration, assignment
   and alias snapshot machinery emits those values. A predecessor retaining an
   old value or arriving from outside the proven region still declines.
2. `CLOSEUPVALS` is accepted only immediately before the final `RETURN` of a
   terminal block. That path never reaches the continuation. A close on a
   surviving path remains excluded, as do captures and closure creation in
   either arm's prefix.

Loop regions, cycles, enclosing-stop escapes, overlapping prefixes and unclear
terminal blocks are still excluded. This change does not add general recovery
for arbitrary phis or capture lifetimes.

## Observations

The independent `loader-cells` source tests missing, false, empty, unversioned,
old, current and future registry cases. It observes the original table alias,
a closure over the assigned cell, later closure creation, a five-result tuple
with a nil gap, and effect order. Separate controls retain an old phi value and
close an inner captured cell before a surviving continuation. All twelve normal
and hard profiles pass in the pinned official Rosetta VM on both engines.
The source and bytecodes are SHA-256 sealed in
`tests/fixtures/shared-return-phis`. Mean similarity improves from 73.3723% to
77.7129%, with token ratio 1.5063 to 1.3672.

The complete native LibDeflate library harness passes all twelve profiles.
Its mean similarity is 75.9700%, and its token ratio is 1.3594. The previous
repeated output was over five times the source's token count and the standard
two-second Myers deadline yielded approximately 0.02% similarity. Both the
removal of repeated code and avoiding that existing metric deadline explain
the large change; the benchmark or its deadline was not modified.

On all 882 cached Quick inputs the same metric changes from 73.29564% at the
previous phi-free revision to 73.81844%, with size ratio 1.06624 to 1.05625.
The original main baseline was 72.29585% and 1.10003. Rescoring by itself does
not assert behavioral equivalence. Raw scores, native library and authored
control VM results, source hashes, and the 1,369-test/137-file passing unit log
are in `benchmarks/results/shared-return-phis-2026-11-27`.

The unchanged native Rosetta check over all 147 Quick-selected sources passes
all 1,764 normal/hard profile combinations with this extension: zero mismatch,
recompile, decompile or refusal results. It uses the original library harnesses
and the exact generated/mutant source hashes recorded by the previous change.
Strict tier release measurements remain the integrated engine's separate gate.
