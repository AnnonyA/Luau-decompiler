# First independent round-two observations

Two project-authored programs supply 18 execution profiles across official
bytecode v9/API and v14/CLI, at O0/O1/O2. `ORIGINAL-SEAL.json` and `IMPORT.json`
preserve the original bytecode hashes and import provenance. Every profile
compares the saved original with the unedited reconstructed source, using
`scripts/closure-identity/run_scenarios.cpp` and one retained chunk per sequence.

`r2h01_raw_capture_alias` activates the chunk with two distinct tables in both
orders: A,B,B,A and B,A,A,B. Both tables share an `__eq` metamethod that always
returns true. The host checks raw function identity, function keys, state changes
and the absence of calls to that metamethod. Source-level equality is not a
replacement for the VM's raw comparison of captured values.

`r2h02_cache_environment_pairs` returns two functions per activation and changes
the owner's and retained function's environments before and between loads. The
same chunk is activated five times. Pair equality, retained identity, function
keys, global reads and a captured counter distinguish independent fresh literals
from unconditional sharing and from the VM's conditional reuse of one owner/K.

The first frozen candidate was `e26040ae485b6e45eb7fa1b301903e3017c81fd7`.
It matched 16/18 profiles; both O2 environment-pair profiles diverged. The exact
first observations remain in `first-observation.json`. These programs became
development regressions after their first evaluation; later fixes are not new
independent measurements. The complete closure benchmark includes this manifest.
