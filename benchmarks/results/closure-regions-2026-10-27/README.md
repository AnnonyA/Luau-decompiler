# Closure constant regions

Seven source reductions, O0/O1/O2, exact official bytecode stored alongside
sources under `tests/fixtures/object-optimized`. Two O2 identity failures were
reproduced before changes: repeated captures of the same table and repeated loads
from separate blocks. Both now pass; different captures remain distinct.

The 21 default profiles include 33 input executions (the branch and NaN cases
have three inputs each). All match the official VM. The JSON report records hashes and complete
observable traces; reconstructed sources are retained here. These are development
regressions, not a new blind competitive evaluation.

The full reduced suite passes 645 profiles / 705 input executions across five
naming configurations. Also passed: 436 unit tests, 44 harness tests, 90 generated
profiles, the existing 200/200, 24/24 and 36/36 comparisons, all 30 large profiles,
and the latest nine competitive profiles as local regressions. No new API
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

Pre-merge review found and reproduced three additional failures in the candidate
implementation: NaN captures are not raw-equal to themselves, a prior environment
change can force clones, and an acyclic CFG detour can execute effects outside the
linear PC interval. All are now covered by regressions. The new eligibility proof
requires known reflexive capture values, an environment-neutral CFG prefix and
inert actual paths between loads. Two additional original programs protect the
previous capture-free, same-block behavior after a call and in nested functions.
Full environment-sensitive cache emulation for that legacy rule remains outside
this change; unknown captured values and broader regions are not claimed supported.
