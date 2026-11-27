# Exact-head CI evidence: 08259cd6

All required GitHub Actions gates completed successfully for published head
`08259cd6c312fe9c41eda0e0c5d0d03d9524cf71`. The local measured source commit is
`ff0275ea025f150d73aa29e10f3f2b7b0111907a`; both have tree `ea3058b85283838ee3a765f19db2a3a7b3a0838f`.

GitHub Actions checked out **the synthetic PR test merge**
`865f2715e55dbaec2f2059b7ed8d239374cbd569` from `refs/pull/82/merge`, incorporating that head
into base `9d4f03fde53d611aef91028a2b1f7529b2f4ffaa`. This commit is not a merge of the PR into main.
The observed PR remains **open, draft and unmerged**.

The synthetic commit's actual Git object was read and its canonical SHA-1
verified. Its tree is also `ea3058b85283838ee3a765f19db2a3a7b3a0838f`, and its parents are exactly
`9d4f03fde53d611aef91028a2b1f7529b2f4ffaa` and `08259cd6c312fe9c41eda0e0c5d0d03d9524cf71`.
GitHub Compare independently reports zero changed files from the published head
to this synthetic test merge. `ci-08259cd6-executed-commit.json` retains that proof.

| Gate | Conclusion | Verified result |
| --- | --- | --- |
| [Node 20.20.2](https://github.com/AnnonyA/Luau-decompiler/actions/runs/46062929544/job/140721285909) | success | 1,322/1,322 units; 69/69 harness; typecheck, build and benchmark checks |
| [Node 22.23.5](https://github.com/AnnonyA/Luau-decompiler/actions/runs/46062929544/job/140721285654) | success | 1,322/1,322 units; 69/69 harness; typecheck, build and benchmark checks |
| [Official Luau parser/runtime](https://github.com/AnnonyA/Luau-decompiler/actions/runs/46062929544/job/140721825278) | success | All steps successful |
| [Browser demo and real Chromium](https://github.com/AnnonyA/Luau-decompiler/actions/runs/46062929616/job/140721285656) | success | 6/6 demo/startup; 1/1 real browser; zero skipped tests |
| [Rosetta Quick](https://github.com/AnnonyA/Luau-decompiler/actions/runs/46062929538/job/140721285433) | success | 882/882; strict mode; zero failure or unusable counts |
| [Rosetta Hard Quick](https://github.com/AnnonyA/Luau-decompiler/actions/runs/46062929538/job/140721285666) | success | 882/882; strict mode; zero failure or unusable counts |

The official parser/runtime job completed every step, including controlled
execution, closure identity, game systems, independent originals, scope and CFG
regressions, rewrite switches, large systems, seeded captures/effects/multiple
returns, and independent regression observations. Its official Luau source pin
was `9d7748a4f324213a18cb8283fa2a77c330225fa0`.

Both Rosetta jobs used `80f3c13ce48dc3318d5d49f54958f580937ca8aa`,
`ROSETTA_MEASURE_ONLY=false`, and recorded cases 246/246, libraries 36/36,
generated 300/300 and mutants 300/300. Full and Hard Full measurements are
separate evidence and are not inferred from these two automatic gates.

The browser log records `CHROME_BIN=google-chrome` and an executed Chromium test
with one pass and zero skips. The deployment job was intentionally skipped for
the pull-request workflow.

The JSON summary includes job URLs, conclusions and exact identities.
`ci-checkpoint-08259cd6-log-hashes.json` contains SHA-256 hashes of every decoded
job log. `ci-checkpoint-08259cd6-log-extracts.txt` preserves the relevant checkout,
version, result and browser lines, with only terminal color escapes removed.
All conclusions come from this head's new jobs. No older CI result was reused.

This inspection made no source changes and no GitHub mutations or merges.
