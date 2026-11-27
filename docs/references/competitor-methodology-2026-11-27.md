# Competitor evidence and its limits

Reviewed 2026-11-27. Observations below distinguish public documentation, exact
returned source, and inference from that source. A service response does not
expose the implementation of its internal analyses.

## Luacid

The [official overview](https://luacid.dev/docs),
[endpoint reference](https://luacid.dev/docs/decompile), and
[limits](https://luacid.dev/docs/limits) document raw-byte POST requests to
`https://api.luacid.dev/decompile`, plaintext source responses and a keyless tier
of 512 KB and 60 requests per minute. We use the documented raw format, no key,
serial requests, hash-and-options deduplication and persistent response receipts.
Only the project-authored synthetic programs authorized for this comparison are
submitted. Sources are recompiled verbatim, including optimization directives.

The endpoint documents optional source transformations such as inline-function
recovery and loop reconstruction. That establishes intended interface behavior,
not how its implementation proves semantic safety. In the new 12 responses
measured for the independently sealed closure programs, all HTTP statuses were
200 and source headers identified v0.2.16. Eight sources contained
`--!optimize 1`; the four O0 responses contained `--!optimize 0`.
Requested and effective recompilation levels therefore remain separate report
columns. The bytecode v9/API and v14/CLI inputs are never silently interchanged.

The first frozen AnnonyA snapshot `e26040a` matched 114/116 execution profiles;
Luacid's exact cached sources matched 107/116. Both failed the two O2 profiles
of `r2h02_cache_environment_pairs`. Both outputs used separate source literals
for two loads of one original owner/K, changing pair equality and table-key
lookups while preserving the observed marker reads and captured counters.
This is evidence about output behavior; it does not identify a private Luacid
pipeline pass. The first observations remain immutable after a case becomes a
development regression. Later fixes are not independent wins on unseen inputs.

## Lua.Expert

The [public API documentation](https://lua.expert/docs) currently describes
`POST https://api.lua.expert/v1/decompile`, a JSON `script` field holding base64
bytecode, and plaintext Luau responses. It does not publish the backend's
closure-identity algorithm. No samples were submitted to Lua.Expert in this
round; public documentation is not a substitute for a comparable execution.

Existing repository reports contain historical Lua.Expert measurements with
their own provenance, including the
[October independent comparison](../../benchmarks/results/independent-2026-10-27/README.md).
That report records 9/9 matches for Lua.Expert and 7/9 for AnnonyA's first
candidate, then 9/9 for the corrected engine. Those older sources, inputs and
protocols are a different corpus. They are not counted as measurements of the
new identity or game-system fixtures. The historical AnnonyA observation records
a dirty working tree and a build hash; it must not be attributed to a clean
commit alone.

## Tovek and the official implementation

Tovek is an inspectable reference at
[`77edf387bf280a2f4d46d57ac85d5c4f071b763f`](https://github.com/Kiet1308/Tovek/tree/77edf387bf280a2f4d46d57ac85d5c4f071b763f).
Its MIT-licensed `ast/src/closure_identity.rs` tracks owner/constant keys and
documents the limit of statically sharing copies with different captures.
Our implementation is independent; no Rust implementation was copied.
Reading that algorithm is recorded separately from executing its output.

The verified native Tovek V2.6.1 binary was also executed on the same two O2
environment-pair bytecodes (v9 and v14). It shared every pair unconditionally,
whereas the original produced `false,true,false,true,true`. Its table-key trace
was `1,2,3,2,2`, versus `nil,2,nil,2,2` in the original. The same native binary
matched both versions of the reduced game register-lifetime case. Separately,
recompiling the 66 historical saved Tovek sources reproduced 63 matches and
three divergences. That last operation is an offline replay, not 66 new native
decompilations. Exact sources, original bytes and both traces accompany the
integration evidence.

The semantic oracle is the saved original bytecode executed with official Luau
[`9d7748a4f324213a18cb8283fa2a77c330225fa0`](https://github.com/luau-lang/luau/tree/9d7748a4f324213a18cb8283fa2a77c330225fa0),
using the same arguments, one-load activation protocol and host environment for
each engine. No general ranking, throughput comparison between HTTP and local
execution, or claim of perfect decompilation follows from these finite corpora.
