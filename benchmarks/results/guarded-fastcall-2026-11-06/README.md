# Guarded loops and single-evaluation consumers

Local validation used Node 24.19.0 and official Luau
`9d7748a4f324213a18cb8283fa2a77c330225fa0`. Reports retain hashes, parser results
and observable traces; summary.json records counts and report SHA-256 hashes.
No competitor API calls were made. Uploaded user material stays outside the repo.

| Gate | Result |
|---|---:|
| Four new originals, O0/O1/O2, three inputs each | 6/12 MATCH before; 12/12 after |
| 76 originals × O0/O1/O2 × 17 rewrite configurations | 3,876/3,876 MATCH |
| 76 originals × O0/O1/O2 × five naming configurations | 1,140/1,140 MATCH |
| Previous semantic / competition / scope corpora | 200/200, 24/24, 36/36 MATCH |
| Large pilot / second cohort | 15/15, 15/15 MATCH |
| Previously independent regressions / seeded fuzz | 9/9, 18/18 MATCH |
| Tovek public inputs | 47/47 decode and parser PASS |
| Tovek paired-source observations | 10 MATCH, 37 NO MEDIDO |
| Unit / harness / demo / Chromium | 581 / 50 / 6 / 1 passed |

The header of a periodic infinite loop can branch to its own iteration backedge
when work is hidden. It must not become a while exit test. Loop classification
and reconstruction now require an actual outgoing edge before extracting such a
test; the independently authored coroutine reduction catches the invented break.

Source reconstruction emits a fallback CALL for optimized builtins. Its use
analysis previously ignored that CALL while counting FASTCALL operands. Generic
FASTCALL has no explicit arguments, so real arguments could be discarded and
then evaluated again. The analysis now counts the emitted CALL and ignores the
VM fast-path operand duplicates. This preserves native/replacement environments,
callee timing and open argument packs without assuming builtins are immutable.

Loop preparation likewise consumes iterator expressions and numeric bounds once.
Only iteration-backedge protocol reads are excluded. A metatable-backed reduction
checks lookup counts and evaluation order for generic and numeric loop inputs.

The four new programs are project-authored development regressions, not a blind
competitive evaluation. The focused report includes both failing baseline and
passing current runs. Existing sources, sealed bytes and assertions were not
modified to obtain matches. Full Roblox-module runtime equivalence was not
measured; the supplied module was inspected and parsed locally only.

Reproduce with existing semantic/competition/regressions/large/independent/fuzz/
Tovek commands and `bench:large:regressions -- --rewrite-options` / `--name-styles`.
The added fixtures and inputs are included automatically in those two matrices.
