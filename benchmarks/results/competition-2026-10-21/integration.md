# Integration status

**Unmerged, draft [PR #58](https://github.com/AnnonyA/Luau-decompiler/pull/58).**
The implementation commit is `c26796f5576cc84dafd03adecf83c29666914d92`.
Nine of 24 new local profiles remain MISMATCH; the CI gate requires all 24 and
has not been weakened. Subsequent integration-note changes do not alter code.

Verified [GitHub Actions run 39710271449](https://github.com/AnnonyA/Luau-decompiler/actions/runs/39710271449):

| Check | Result |
|---|---|
| Test, typecheck and build — Node 20 | PASS |
| Test, typecheck and build — Node 22 | PASS |
| Official syntax comparison, 25 corpus files | PASS |
| Existing controlled semantics, 200 profiles | PASS |
| New originals, 24 profiles | FAIL: 15 MATCH, 9 MISMATCH |

The failing step is **Check 12 independent originals against the official VM**.
It reproduces matrix-scope O0/O1, rollback O0/O1, codec O0/O1, graph-walk O0/O1,
and branch-phis O0 failures. External engines are NO MEDIDO in this CI run
because CI intentionally makes no API requests and has no extracted API cache;
this does not replace the measured, cached external results in `after.json`.
The job uploaded comparison evidence despite the failed gate. Machine-readable
job/step results are retained in [actions.json](actions.json).

The separate [Browser demo run 39710271441](https://github.com/AnnonyA/Luau-decompiler/actions/runs/39710271441)
passed its build and real-browser checks. Deployment was correctly skipped for
the draft PR. The previous main Chromium-startup failure did not recur here.

Local checks: 344 unit tests; 34 benchmark tests; 200/200 prior semantic profiles;
25/25 syntax corpus files. Extracting the committed archive into a fresh temporary
directory and replaying it reproduced all 24 bytecode hashes and 72 engine
classifications with zero HTTP requests. Archive/report SHA-256 checks passed.
