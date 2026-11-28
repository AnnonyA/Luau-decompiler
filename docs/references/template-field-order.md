# Recovering the order of preloaded table fields

This change restores a retained `DUPTABLE` template's field order. It addresses
both source structure and an observable layout defect: printing the same named
keys in a different order can change the order returned by `next`.

The implementation is independent. The reference inspection covered:

- [Tovek `ce2ea332`, `ast/src/table.rs`](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/table.rs),
  particularly `TableShape`, layout compatibility and preservation of insertion
  history; and
  [`rebuild_table_literals.rs`](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/rebuild_table_literals.rs),
  particularly private constructors and template field placement. The inspected
  license is MIT, copyright Jujhar Singh and Mathias Pedersen, 2024. No Rust
  implementation was copied or adapted.
- Official Luau
  [`c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`, `compileExprTable`](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/Compiler.cpp)
  and
  [`9d7748a4f324213a18cb8283fa2a77c330225fa0`, `compileExprTable`](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/Compiler.cpp).
  A record-only constructor of at most 32 fields can compile to a template.
  Its key sequence is retained even when literal values need no subsequent
  store instructions.
- The corresponding
  [`c875` VM loader](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/VM/src/lvmload.cpp)
  and
  [`9d` VM loader](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lvmload.cpp),
  `LBC_CONSTANT_TABLE_WITH_CONSTANTS`, insert the keys in template order.
  Nil-valued entries are cleared after this insertion phase. The VM's
  [`LOP_DUPTABLE`](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/VM/src/lvmexecute.cpp)
  clones that layout. Key count alone is insufficient to describe it.

## Cause and bounded repair

For an input such as `{ early = value, marker = 7, late = other }`, the
template retains `early, marker, late`; only the nonconstant values need stores.
Reconstruction initializes the fields from that template, then replaces the
nonconstant placeholders as it sees the stores. Removing an old placeholder
and appending its replacement can leave `marker, early, late`. A pending child
constructor can similarly be appended after a later literal field.

`TemplateFieldOrder.ts` uses the actual constant table associated with the
allocation instruction. It has no source input, benchmark identifier, naming
heuristic or scorer dependency. Both pending-table flush paths call it before
the final array-field normalization.

Admission requires all of the following:

1. The original allocation is a `DUPTABLE` with a `tableWithConstants` constant,
   containing 2–32 unique valid identifier keys.
2. The private pending constructor contains exactly those keys, once each, as
   named fields. Missing, extra, repeated, computed, bracketed and positional
   fields decline the rewrite.
3. A movable field is a literal whose value exactly matches a primitive value
   preloaded by that template. Boolean, string, nil and numeric constants are
   supported. Signed zero is distinguished; NaN is excluded from the identity
   proof. A key-only reservation or an ordinary literal store is insufficient.
4. All remaining fields keep their object identity and their relative order.
   This includes calls, property reads, allocations, closures and literals that
   are not proven preloaded constants. Their expressions are never rewritten.
5. A direct function literal must retain the debug name required by its named
   field. Otherwise the printer needs bracket syntax and the record-template
   proof does not apply.

The rewrite changes no expression's scalar/list context, call boundary, local
binding, capture or result pack. It adds no field or key and changes no key
count. The reconstructed record fields use the retained template order and the
same hash capacity, without allocation padding. The callback controls also
observe caller names and function debug names.

This does not restore arbitrary `NEWTABLE` layout, missing constructor writes,
multi-key zero reservations, or a runtime store order that has already been
lost. It does not move two nonconstant fields across each other. The earlier
mixed-key/capacity defect recorded with the table-key identity work remains a
separate limitation.

## First independent observations

The parent revision was
`885eb08b0fd1bd9beb513db9fd90e5c369e8293e`. Two authored sources were compiled
at O0/O1/O2 and g1/g2 using each real official pin listed above. Original
bytecodes were sealed before the engine change and reused for the repaired run.

The baseline passed 16 of 24 exact round trips. The eight failures were the
layout fixture at O1/O2, both debug levels and both pins: table iteration order
changed. The effects fixture already passed all 12 profiles. The candidate
passes all 24, including callback order, scalar adjustment of multiple-return
calls, closure identity, debug names, overwritten fields and extra fields.

The first failing outputs remain intact in
`benchmarks/results/template-field-order-2026-11-27/baseline-first-885.tar.gz`.
The candidate archive keeps the repaired outputs separately. Both archives
contain the complete original observations and emitted/recompiled outputs;
the immutable input sources and bytecodes are in
`tests/fixtures/template-field-order/`. The evidence manifest supplies archive
hashes and canonical JavaScript-tree hashes. It also documents the earlier
hexadecimal-digest hash encoding in the untouched observation summaries.

Build and all **1,828 unit tests in 155 files** pass. This includes 28 new focused
tests; no existing assertion was weakened or changed.

## Quick measurement

The diagnostic replay uses the unchanged 882 Quick input bytecodes, default
query/options, and the unchanged Rosetta metric at pinned revision `80f3c13`.
It reports source quality; it does not substitute for a strict behavioral run.

| Measurement | Parent 885eb08 | Candidate |
| --- | ---: | ---: |
| Mean similarity | 77.256928016% | 77.322433865% |
| Geometric source-size ratio | 0.9854781501 | 0.9854781501 |
| Decompilation errors | 0 | 0 |

The improvement is **0.065505849 percentage points**. Exactly 228 outputs
change and improve their score; the remaining 654 outputs are byte-identical.
Every per-program token count remains identical. No score decreases, and local
counts, nesting, endless-loop counts and recovered-name counts remain unchanged.

The candidate diagnostic ran under Node 24.22.3; the cached parent diagnostic
ran under Node 22.23.5. The native compiler/VM controls above exercise the actual
Luau behavior. The integration owner runs the strict Quick gate on the combined
head. No Full, Hard Quick or Hard Full run was added for this change.

The preceding read-only census used engine `2b2f5b4` and its 882 cached pairs.
It found 11,538 `NEWTABLE` instructions and 4,876 `DUPTABLE` instructions. Of
2,658 `NEWTABLE` allocations with a hash part, the 160 bounded private prefixes
containing only valid named string keys all originated from `{}` followed by
stores, rather than complete bracketed constructors. No complete constructor
of 1–32 valid string keys was verified to have lost every bracket. Therefore
that broader spelling idea was not pursued as a Quick improvement.

For template order, 276 unambiguous source/output table pairs had reordered
string keys; 270 also matched the retained template sequence. This census was
diagnosis only. The implementation's admission uses bytecode and reconstructed
fields, and its measured gain above comes from running that implementation.
