# Decompiler development

- When improving reconstruction or semantic fidelity, inspect the relevant code in
  https://github.com/Kiet1308/Tovek and the matching official Luau compiler/VM code.
  The user explicitly requests Tovek as an ongoing engineering reference.
- Start with `docs/references/tovek-capture-reconstruction.md` and its pinned links;
  inspect only the area relevant to the current change. Record the exact revision
  when consulting a newer revision. README claims are leads, not validation.
- Fit useful invariants to our IR and algorithms. Verify the license before
  copying/adapting implementation code and preserve required notices. Explain
  what was independently implemented versus adapted; do not claim an entire
  Tovek feature when only a bounded case is supported.
- Reproduce behavioral failures with project-authored Luau and official O0/O1/O2
  compilation where supported. Keep sealed originals, bytecode and competitor
  outputs unchanged. Preserve the first independent result when a case becomes
  a development regression. Prefer cached external API responses.
- Test capture lifetime/identity, side-effect order and multiple-return arity
  when touching CFG, SSA, reconstruction or cleanup. No weakened assertions,
  hidden failures or unsupported results relabeled as MATCH.
- Merge only after the required Node 20/22, official parser/runtime and demo CI
  checks pass. Keep changes on a feature branch until then.
