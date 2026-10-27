# Closure constant regions

Three new source reductions, O0/O1/O2, exact official bytecode stored alongside
sources under `tests/fixtures/object-optimized`. Two O2 identity failures were
reproduced before changes: repeated captures of the same table and repeated loads
from separate blocks. Both now pass; different captures remain distinct.

The nine default profiles include 15 input executions (the branch case has three
inputs). All match the official VM. The JSON report records hashes and complete
observable traces; reconstructed sources are retained here. These are development
regressions, not a new blind competitive evaluation.

The full reduced suite passes 585 profiles / 615 input executions across five
naming configurations. Also passed: 430 unit tests, 44 harness tests, 90 generated
profiles, the existing 200/200, 24/24 and 36/36 comparisons, all 30 large profiles,
and the latest nine competitive profiles using cached responses only. No new API
requests were made, and no sealed source, bytecode or competitor output changed.

Reproduce:

```bash
npm run build
npm run bench:large:regressions -- --name-styles \
  --luau-compile /path/to/luau-compile --luau /path/to/luau --output /tmp/closure-regions
```

Captured constant sharing is limited to proven non-repeating top-level regions;
reentrant/loop-dependent caches and effectful paths still need separate work.

A separate irreducible-CFG regression requires cyclic SCC detection even when
natural-loop analysis finds no loop; sharing is refused in that region.
