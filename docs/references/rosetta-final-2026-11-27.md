# Rosetta reconstruction work and evidence

The [measured Rosetta report](../../benchmarks/results/rosetta-final-2026-11-27/README.md) contains the four-tier results, raw reports, exact competitor snapshots, exclusions, local validation, and commit mapping. **Status: Complete measured results.** Measurements identify local `ff0275ea025f150d73aa29e10f3f2b7b0111907a` and its identical published tree at `08259cd6c312fe9c41eda0e0c5d0d03d9524cf71`.

## Control flow and loop values

The reconstruction changes preserve the relationship between loop headers, latches, true exits, and continuation blocks after bytecode layout changes. They distinguish an actual control-flow edge from a virtual advance to a structured join; keep loop-exit values available outside the loop; and recognize terminal returns structurally rather than by physical bytecode position. Repeat conditions can span more than one block. Generic iterator preparation and natural-loop membership now use the semantic edges rather than an invented linear fallthrough.

These are bounded reconstruction repairs with project-authored reproductions and official-VM traces. See [loop values](rosetta-loop-values.md), [repeat paths](rosetta-repeat-paths.md), [shared continuations](rosetta-shared-continuation.md), [generic-loop entry](generic-loop-entry.md), [terminal adapters](terminal-return-adapters.md), and [terminal return layout](terminal-return-layout.md).

The final shared-follow repair checks whether a bounded linear exit path contains work before treating that path as an empty transfer to a shared continuation. Assignments and effects on that exit must remain observable. In the independently authored layout control, six original/permuted pairs execute identically in the official VM; decompilation improves from 0/6 to 6/6 while twelve ordinary/Hard controls remain passing. The [independent observations](loop-exit-work-observations.md), [their retained evidence](../../benchmarks/results/loop-exit-work-observations-2026-11-27), and [development regressions](../../benchmarks/results/loop-exit-work-2026-11-27) preserve the first failures. Directed repairs are not substituted for a fresh full-suite result.

## Evaluation count, order, and result arity

Copies of a scalar register remain one value even when a later operation reads that register more than once. In particular, self-selection through `AND`/`OR` must not evaluate an effectful producer twice or reopen a multiple-result call. Expression folding retains the required evaluation of a condition even when both control-flow destinations coincide. Register-use analysis follows CFG reachability, so physically earlier consumers are not mistaken for dead values after block shuffling.

See [register self-copies](register-self-copies.md), [uses across layouts](register-uses-across-layout.md), [unused conditions](rosetta-unused-conditionals.md), and [evaluation boundaries](rosetta-evaluation-boundaries.md). Their controls include false/nil/truthy values, side-effect traces, captures, object identity, and result counts. Numeric/literal handling has its own [value-fidelity evidence](literal-value-fidelity.md).

## Constructors and open packs

Table reconstruction preserves the order of scalar field evaluation before an open result tail. Pending constructor state can cross valid CFG blocks without losing earlier fields, and consumers do not accidentally repeat calls whose result was already materialized. Reachability checks exclude dead predecessors when deciding whether a pack is forwarded. Empty string keys remain real keys.

See [constructor evaluation order](constructor-read-order.md), [call/constructor boundaries](rosetta-call-constructor-boundaries.md), and [split constructors](split-table-constructor.md). The raw originals, first failures and later regression traces are preserved separately.

## Lexical identity, names, and register pressure

Name cleanup uses lexical binding identity and declaration scope. A global whose spelling resembles an automatically generated temporary remains a global. Coalescing must not absorb a declaration from a different scope or change the lifetime of a captured cell. High-pressure compaction removes safe aliases and shortens local lifetimes while retaining effect order, argument grouping, and captures.

See [global provenance](rosetta-global-provenance.md), [local coalescing](rosetta-local-coalescing.md), [register pressure](rosetta-register-pressure.md), and the project-authored nested-pressure fixtures in the final validation. Passing the compiler's register/local limit is checked by recompiling and running the output, in addition to checking syntax.

## Engineering references and limits

The engine work consults the pinned Tovek algorithms and the corresponding official Luau compiler/VM areas, as required by [the project reference policy](tovek-capture-reconstruction.md). Individual notes record the exact inspected revision, license checks, independently implemented invariants, and whether any source was adapted. Public API behavior is not evidence of a competitor's private implementation.

The reported comparison uses the exact Rosetta-published Luacid and lua.expert results audited in [the upstream comparison](rosetta-upstream-2026-11-27.md). It makes no speed claim. Against these published snapshots, AnnonyA exceeds Luacid in all four tiers. It ties lua.expert on Quick at 882/882 and exceeds it on Full, Hard Quick, and Hard Full. The six unusable seed1541 original/profile pairs in each full tier stay visible and excluded consistently with the upstream pin. Scores are never formed by adding directed regression successes to an older complete suite result.

The strict runner validates every inventory and profile result, preserves subprocess failures and source/build provenance, and rejects transform or decompiler-option overrides. [The final report](../../benchmarks/results/rosetta-final-2026-11-27/README.md) gives reproducible commands, score accounting, evidence hashes, exact engine mapping, and the limits of the finite corpus.
