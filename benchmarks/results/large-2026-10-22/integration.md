# Integration status

Branch: `benchmark/large-systems`. This work is intentionally a draft and must not merge while the six reserved profiles remain MISMATCH.

Local verification: 365 unit tests; 39 benchmark tests; TypeScript/build; 200/200, 24/24, 36/36 unchanged semantic baselines; 21/21 small regression profiles; 9/9 large development profiles; 0/6 large reserved profiles; official parser 25/25 generated + 22/22 reference; demo build, 3 harness tests and Chromium smoke test.

The CI workflow requires Node 20/22, existing parser/VM checks, demo, small regressions, development and reserved-corpus checks. The reserved-corpus gate has no failure suppression. Remote Actions results will be appended after the PR run.
