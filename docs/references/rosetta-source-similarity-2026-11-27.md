# Source similarity reconstruction — 2026-11-27

This work removes scaffolding introduced by reconstruction while preserving the
behavior represented by the input bytecode. The requested source-similarity
targets are 82.2%, 90%, and ideally 100%. They are targets, not acceptance facts.
The [four-tier measured report](../../benchmarks/results/rosetta-source-similarity-2026-11-27/README.md)
records the actual achieved scores, output token ratios, behavioral verdicts,
engine identity, and validation. Earlier diagnostic replays are explicitly
separate from those final strict runs.

## What changed in the engine

### Retain call behavior with smaller source forms

An original call can matter even when a compiler could optimize the printed
source into something else. Calls can observe argument order, mutable captures,
function identity, the environment, and stack frames. The existing boundary
metadata is retained. A final lexical analysis chooses a smaller spelling:

- `(true and callee)(arguments)` replaces the longer constant conditional
  boundary when a function literal could become newly inlineable.
- `(callee)(arguments)` is enough when the final callee cannot expose an
  inlineable literal; the group still blocks new builtin recognition.
- A known immutable local or alias to a variadic function literal can use a
  direct call. Neither pinned compiler inlines such a literal, and it cannot
  be mistaken for a builtin. Its signature and body remain unchanged.

Unknown bindings, cycles, analysis limits, and potential literal aliases retain
the required boundary. This is a printer decision after naming and cleanup,
not a declaration that an arbitrary call is pure.
[Implementation and pinned compiler references](compact-call-boundaries.md)

Valid constant string keys use record syntax where it preserves the function's
observable debug name. Anonymous function literals keep bracketed field forms
when record or method syntax would invent a name. The new authored control
exposed an existing anonymous-name error in all six normal profiles: the old
engine passed 0/6; the repaired engine passed 6/6. The first failures and the
unchanged originals are retained in the linked evidence.

### Recover shared continuations and loop conditions

Shared terminal returns no longer require repeated copies of an acyclic
continuation when the reconstruction proof establishes the same live values
and preserves closure closing. Defined phi inputs and terminal closing are
handled explicitly. Unsupported regions and active-loop interactions remain
outside that proof.
[Shared returns](shared-return-conditions.md) ·
[Defined phis and closure closing](shared-return-phis.md)

Introduced `while true`/break forms can recover their original loop condition
when the head or latch has the required structure and no intervening work is
lost. Tail result flags can disappear when they merely provide a private
primitive result's literal default. Every writer must be proven primitive,
the result cannot be captured or read inside the loop, and successful stores
must lead to the current loop's break. The primitive restriction avoids
shortening the lifetime of an object hidden in an otherwise unread variable.
[Loop conditions](loop-condition-presentation.md) ·
[Loop result defaults](loop-result-defaults.md)

### Preserve provenance while folding temporary locals

Declaration grouping uses debug scope and producer identity rather than a
coincidental name. Temporary provenance includes the owning prototype, program
counter, and register. Names inferred for another prototype no longer prevent
safe scratch-value folding, while explicit API source-name hints still protect
their intended declarations.

Scalar producer packs retain their one-value adjustment when moved to a list
tail. Prefix effects, exceptional table-key evaluations, captured cells, and
unknown producers constrain the fold. A new unused-property control also
exposed an existing lost `GETTABLEKS` effect; guard reconstruction now retains
that evaluation even when its result has no consumer.
[Parallel declarations](debug-parallel-declarations.md) ·
[Temporary provenance and effects](temporary-provenance.md)

### Print scalar expressions without redundant parentheses

An adjusted call needs parentheses where a final expression could expand into
several results. It does not need extra adjustment syntax where the enclosing
operator, test, keyed field, or list position already requests exactly one
value. The printer follows that distinction without changing the AST's
underlying adjustment.

This work also found a pre-existing iterator error. A call that produced only
one iterator value could reopen the factory's extra results when explicit nil
state/control slots were removed. The reconstructor now requires an exact
three-result producer and matching SSA consumers before using an open iterator
initializer. The authored control improved from 4/12 to 12/12 normal/hard
profiles; the initial eight failures remain archived.
[Scalar parentheses and iterator result arity](scalar-parentheses.md)

### Reassemble returning guards and private logical values

Adjacent equal terminal return arms can share a condition; suitable return
ladders become `elseif` chains; a small return guard can precede a large
continuation. Equality complements can simplify after boolean recovery.
Ordering comparisons are not inverted because NaN makes that transformation
invalid. Function creation and ambiguous exits keep their existing shape.
[Returning guards](terminal-guard-presentation.md)

A private terminal cell that is repeatedly tested, assigned, and returned can
recover an expression such as:

```luau
return first and second and (if flag then data.force else true)
```

Intermediate backing values are restricted to primitive literals or unchanged,
uncaptured parameters of the same function. Ordinary locals, globals,
allocated objects, and unknown producers do not qualify. The parameter's
retained reference is checked against both pinned compiler implementations;
the rule does not assume that every future compiler has the same lifetime
policy. Final assigned calls remain scalar, existing open return packs are
rejected, and selected effects retain their evaluation point.
[Private logical returns and lifetime proof](private-logical-returns.md)

## What Rosetta's similarity and size actually measure

The pinned [quality implementation](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/src/quality.rs)
normalizes names, numbers, and strings, then compares token sequences. Keywords
and operators remain significant. The [lexer](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/src/lex.rs)
ignores whitespace and comments. Renaming variables and changing indentation
therefore do not raise this score. Debug-name recovery has a separate metric.

The overall similarity is an arithmetic mean over passing source/profile
pairs. The size value is the geometric mean of
`(output_tokens + 1) / (source_tokens + 1)` over those pairs. It is not a byte
count, compressed download size, or a guarantee that every output has the same
length as its original. The metric's bounded Myers computation has its
upstream two-second deadline; that implementation and its deadline are
unchanged.

The final benchmark uses default engine options and the unchanged pinned
corpus, transforms, execution limits, and strict validator. No source lookup,
case-name special handling, competitor response substitution, or custom
similarity formula is used. A diagnostic option comparison and a broader
fixed-arity purity analysis were explored separately. The optional settings
did not become benchmark overrides; the redundant purity analysis was
discarded.

## Why exact source recovery has a limit

These independently authored originals compile to identical serialized
bytecode at the relevant optimized profiles:

```luau
return 1 + 2
```

```luau
return 3
```

Their normalized source token sequences differ. A bytecode-only decompiler
receives the same input for both, so it cannot guarantee a perfect source-token
match to both originals. Dead branches, type assertions, and inlined calls
provide further concrete examples. The archive retains all eight authored
sources, all 48 compiled bytecode files, their hashes, and all 24 profile
comparisons, including the eight comparisons whose bytes differ.
[Reproduction and exact evidence](../../benchmarks/results/source-recoverability-2026-11-27/README.md)

This establishes ambiguity in general. It does **not** establish a numerical
ceiling for Rosetta, and it does **not** prove that 82.2% or 90% is unattainable.
Remaining quality work includes broader justified recovery of optimized helper
structure and temporary scope. Inventing compiler-erased expressions or
unobserved original annotations would not recover them from the bytecode.
The [remaining region-recovery investigation](remaining-inline-recovery.md)
identifies a concrete family of expanded helpers and its unresolved frame,
environment, capture, and compiler constraints. Its intermediate diagnostic
scores are not a measured improvement of a new candidate.

## Validation and provenance

Each reconstruction change has authored controls covering the relevant
capture identity/lifetime, effect order, or result arity, with sealed originals
and normal/hard O0/O1/O2 compilation where applicable. Existing first failures
remain alongside the repaired observations. They are development regression
coverage, not blind holdouts.

The integrated engine is frozen at local commit
`326d85ed21c0a7bef6dcd07a26e38b49f0148a84`. Its full Git tree is
`596bd4510ff32ebb978dbfaf15d9814dbcc1b198`. The combined root unit run passed
1,540 tests in 145 files. Four isolated strict tier worktrees and separate
Node 20/22 validation worktrees use that exact source. The final report maps
the local tree to the published GitHub engine commit and records source and
distribution hashes; later documentation commits do not stand in for a
different measured engine.

Required GitHub checks additionally cover the official pinned parser/runtime,
public corpora, and a real Chromium execution of the browser demo. Local lack
of a Chromium binary is recorded as a missing local gate, not a browser pass.
Merge status and final check evidence are recorded separately from diagnostic
quality improvements.

## Engineering references

The relevant invariants were checked against Tovek
[`ce2ea3325547fa3896f274b68013386338039040`](https://github.com/Kiet1308/Tovek/tree/ce2ea3325547fa3896f274b68013386338039040)
and official Luau
[`c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`](https://github.com/luau-lang/luau/tree/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f),
with the required CI compiler
[`9d7748a4f324213a18cb8283fa2a77c330225fa0`](https://github.com/luau-lang/luau/tree/9d7748a4f324213a18cb8283fa2a77c330225fa0)
also inspected where compiler recognition or parameter lifetime matters.
The linked change notes identify the exact modules and proof boundaries.
The TypeScript changes were independently implemented; no Tovek Rust code
was copied or adapted. Its MIT license was inspected before using it as an
engineering reference.
