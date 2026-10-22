# Integration status

Draft PR: https://github.com/AnnonyA/Luau-decompiler/pull/59

Engine/benchmark commit: `0229dbc558a21283c5db024f13d2e89b4dee2fa1`. No merge; six reserved profiles remain MISMATCH.

Local verification: 365 unit tests; 39 benchmark tests; TypeScript/build; 200/200, 24/24, 36/36 unchanged semantic baselines; 21/21 small regression profiles; 9/9 large development profiles; 0/6 large reserved profiles; official parser 25/25 generated +22/22 reference; demo build, 3 harness tests and Chromium smoke test.

Remote Actions verified on the engine/benchmark commit:

- [Node20/22 and official Luau job](https://github.com/AnnonyA/Luau-decompiler/actions/runs/39832186176): both Node jobs passed. Official syntax, 200/24/36 baselines, 21 small regressions and 9 development profiles passed. The only failed step is `Check reserved large systems without external requests`, with six honest MISMATCH results. Evidence upload succeeded.
- [Browser demo](https://github.com/AnnonyA/Luau-decompiler/actions/runs/39832186243): passed on the one retry after an initial Chromium startup timeout. UI assertions were not changed. Deployment is skipped for a PR.

`actions.json` stores the job/step outcomes and exact checked SHA. The follow-up documentation commit does not change executable code. The strict semantic gate remains active, without continue-on-error or failure suppression. Expansion to fifty large programs and semantic acceptance of the two reserved architectures remain pending.
