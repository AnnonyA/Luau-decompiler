# Wrapper startup failure — not an engine measurement

All 24 wrapper invocations failed at line 4, before importing or invoking either decompiler. `Array.map(resolve)` passed the array callback index and array as extra arguments to `path.resolve`. The 48 profile rows are retained exactly as initially recorded, but their DECOMPILE_ERROR labels identify wrapper startup failures and must not be interpreted as engine results.

No reconstructed source was returned. All 24 original-bytecode replays passed. The fixed wrapper uses `map(argument => resolve(argument))`; a new immutable run directory records the first actual engine observations. No source, assertion, bytecode or expected original result changed.
