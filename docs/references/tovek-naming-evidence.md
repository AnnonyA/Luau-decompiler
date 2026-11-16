# Names from evidence (2026-11-16)

Reference inspected: [Kiet1308/Tovek at ce2ea332](https://github.com/Kiet1308/Tovek/tree/ce2ea3325547fa3896f274b68013386338039040),
MIT license: `ast/src/name_locals.rs`, `ast/src/refine_names.rs`,
`ast/src/name_spelling.rs` and `ast/src/naming_api.rs`. No Tovek code was
copied. The rule tables in `src/reconstruct/NameEvidence.ts` were written for
our AST; the lists of API argument slots, Instance methods and result
participles follow the same public Luau/Roblox APIs Tovek's tables describe,
so individual entries coincide.

## What Tovek does

Tovek scores naming hints and lets the strongest win: the initializer
(`Instance.new("Part")` is `part`, `:FindFirstChild("X")` is `x`,
`:GetChildren()` is `children`), the API slot an argument fills
(`math.clamp(value, min, max)`), the field a value is stored under, how a
parameter is used (Instance methods, string methods, being called), event
signatures and call-site consensus. Without evidence a local is `v`, a
parameter `p`. Names are unique per lexical scope rather than per file.

## What we implement

A bounded subset, deterministic and purely a renaming:

- **Initializer roles** (`nameFromInitializer`): constructors, `Instance.new`
  class names, `require` paths, child lookups, `GetXxx` methods, attribute
  keys, clock reads, `pcall` tuples (`success, result`), length (`count`), and
  the element of a named collection for a loop variable (`players` gives
  `player`).
- **Use evidence** (`argumentSlot`, `nameFromFieldKey`, `nameFromUses`): the
  API slot a bare argument fills, the field or attribute a value is stored
  under (`sound.Volume = volume`), and the shape of a parameter's uses
  (`instance`, `player`, `input`, `text`, `callback`, `list`, `data`).
- **Casing** (`lowerCamel`): acronym-aware lower camel case; only chunk-level
  handles from `GetService`, `require` and literal child lookups keep the
  capitals of the instance they name.
- **Numbering**: the reconstructor's module-wide suffix (`value87`) is only a
  working name. Each function numbers its own bindings (`value`, `value2`).
- **Neutral names**: a parameter nothing is known about is `p`; a table is
  `list`, `data` or `tbl` by the shape of its constructor instead of `config`.

Existing rules keep priority over the new evidence, including the conservative
field-role rule from the previous round: `x and y.Field` names nothing when
the guard and the receiver differ, and two competing reads under `or` name
nothing.

Only names the reconstructor chose itself are re-derived. A name from debug
info, a function's debug name, or a tree handed to `cleanupAst` by a caller is
the author's: it is kept, reserved against inferred names, and at most given a
per-function number when the allocator had suffixed it.

## Not claimed

Tovek's interprocedural consensus beyond the existing `FunctionEvidence` pass,
its role graph in `refine_names.rs`, pluralized collection names, set/map
naming and its soft-reserved builtin synonyms are not reproduced. A value
returned by a method whose name is an action (`:Play(...)`) keeps the neutral
name.
