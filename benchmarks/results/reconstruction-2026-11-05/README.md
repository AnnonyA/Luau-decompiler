# Loop exits, captures and wide calls

Local validation: Node 24.19.0, official Luau
`9d7748a4f324213a18cb8283fa2a77c330225fa0`.
Machine-readable counts and SHA-256 hashes are in `summary.json`. Compressed JSON
contains the original harness reports, parser checks, bytecode hashes and traces.
These are development regressions; no new blind competitive evaluation is claimed.
No competitor API requests were made.

| Corpus | Result |
|---|---:|
| Previous semantic corpus | 200/200 MATCH |
| Twelve original programs | 24/24 MATCH |
| Scope/register regressions | 36/36 MATCH |
| Large pilot, development + observed | 15/15 MATCH |
| Second cohort, development + observed | 15/15 MATCH |
| Previously independent systems, now regressions | 9/9 MATCH |
| Seeded fuzz | 18/18 profiles, 90 input comparisons |
| 69 reduced programs, O0/O1/O2, five naming styles | 1,035/1,035 MATCH; 1,710 input comparisons |
| Pinned Tovek bytes | 47/47 decode and official parser PASS |
| Tovek paired-source observations | 10 MATCH, 37 NO MEDIDO |
| Unit / harness tests | 523 / 50 passed |
| Demo / Chromium | 6 / 1 passed |

The second cohort's observed partition improved from 5/6 to 6/6 locally. Cached
LunaUX results are 5/6 and Lua.Expert 6/6. In `constraint-search/O2`, our raw output
selected the right closure, but cleanup missed an assignment inside `do` and
redirected the call to an older closure. Replacing resolved binding references
fixes both that write and interpolation references. This case was already used
in development; it is not evidence of general competitive superiority.

The five failing paired-source Tovek observations from the preserved
[earlier report](../tovek-public-2026-10-29/README.md) now pass: numeric loop returns,
skipped loop tails, fresh captured callees, and both large-local fixtures. These
are observations against published paired sources with today's VM, not direct
execution of legacy bytecode or a Tovek engine comparison. Roblox-dependent and
unexercised modules remain NO MEDIDO.

Additional fixes preserve cells after terminal loop returns, respect cell closes
at inlined joins, avoid redundant capture snapshots, commit oversized pending
tables, and bound lexical lifetimes. New wide-call regressions exposed a hard
64-register scan limit; calls, returns and SETLIST now retain the entire fixed
prefix and the open tail. Ordered single-use argument folding avoids local
register exhaustion while retaining callee timing and fixed-result arity.

The new fresh-callee regression originally had no trace for zero iterations;
an unconditional count was added before adopting it. Its identity assertions
remain intact. Previously sealed originals, bytes and competitor results were
not changed. The pre-fix reports are retained beside the successful reports.

Reproduce with the existing `bench:semantic`, `bench:competition`,
`bench:regressions`, `bench:large`, `bench:large:regressions -- --name-styles`,
`bench:independent`, `bench:fuzz -- --count 6`, and `bench:tovek` commands, supplying
the pinned compiler/runtime paths. CI also checks Node 20/22 and Chromium.

Limits remain: arbitrary de-inlining, irreducible control flow, capture-free
NEWCLOSURE identity, and oversized irreducible register sets are not solved by
these bounded corrections. The corpus has not been expanded to 50 large systems
in this round.
