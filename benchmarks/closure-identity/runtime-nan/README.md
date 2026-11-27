# Runtime numeric captures, including NaN

This development regression follows the first round-two independent evaluation.
Its original outputs were sealed before testing this source against a candidate.
Six saved bytecodes cover v9/API and v14/CLI at O0/O1/O2; two activation protocols
give 12 profiles. `scripts/closure-identity/run_numeric_pairs.cpp` loads each
chunk exactly once and supplies either 1,NaN,NaN,1 or NaN,1,1,NaN. Every activation
returns two closures. The host checks both identities, function keys and all
eight returned capture values, without comparing unstable function addresses.

At O1/O2, the first load with the constant's environment initializes its
captures, including a NaN value. Initialization does not make NaN reflexive. With
1,NaN,NaN,1, the first and fourth functions share identity; the middle functions
are distinct. With NaN first, subsequent loads remain distinct even when two
consecutive captures are both 1: an incompatible clone does not replace the
constant's first capture. At O0 the compiler emits fresh closures. These facts
are observations of the pinned original bytecode, not fixture-specific rules in
the decompiler.

The complete closure benchmark verifies every saved hash, compiles the returned
source without edits through the version-appropriate compiler entry point, and
compares stdout, stderr and exit status. Any mismatch makes the command fail.
