# Cohort 2: independently authored large systems

Five new architectures, 1,027–1,695 significant physical lines, each with 12 deterministic input pairs and official O0/O1/O2 bytecode. Development: archive filesystem, document layout, symbolic algebra. Reserved: constraint search, geometry pipeline. They were authored separately without consulting old benchmark sources or decompiler output. Archive, geometry and constraint sources are handwritten; the algebra/layout generator documents its specialized templates. Repeated handlers do not count as independent systems.

All 180 original runs passed before any decompilation. `manifest.json` and `bytecode-sha256.json` seal sources and bytes; `bytecode/` preserves the exact compiled files. `original-validation.json` records compiler/runtime hashes and original traces. Never regenerate these references to accommodate engine failures.

`engine-freeze.json` records the initial pre-authoring build. Independent review then found a captured-register regression, fixed without observing cohort2 outputs. `evaluation-freeze.json` records that corrected build before the first evaluation; the earlier record is retained.

The first comparison used 30 new external calls, no retries, the same bytecode for all three engines and the existing cache. API docs checked on 2026-10-23: LunaUX public HTTP endpoint needs no key and publishes no numerical request limit; Lua.Expert documents 500/minute. The existing 1.25-second interval, request budgets, timeout, response-size ceiling and circuit breakers remained enabled.

See [first frozen measurement](../../results/cohort2-2026-10-23/first-comparison.md). It is preserved separately from subsequent development runs. Reserved cases have been measured but are not used to tune the motor in this round. Later rechecks are regressions, never another blind score.
