# Changelog

This file records package history and dated development milestones. The package
currently declares **0.2.0** in [package.json](package.json). As of 2026-11-27,
the repository has no published GitHub Releases or Git tags; entries below link
to recorded commits rather than assigning new release numbers.

## Unreleased

- Improve Quick source similarity from **76.93% to 77.50%**, retaining
  **882/882** behavioral passes. The 100% similarity target remains unmet;
  [the integrated report](benchmarks/results/rosetta-refinement-2026-11-27/README.md)
  records exact results, provenance and rejected experiments.
- Recover shared short-circuit bodies and iteration continuations; preserve
  copies before reference capture, table template order and function key names.
- Validate the combined engine with **1,917** unit tests on Node 20 and 22,
  six demo worker/startup tests and 96 native profile checks on two Luau pins.
- Present the browser interface as **LUVEX**, with the repository, package and
  CLI identities retained as Luau Decompiler, `luau-decompiler` and `luau-decompile`.
- Shorten the README and move detailed usage and development instructions to
  [docs/usage.md](docs/usage.md) and [docs/development.md](docs/development.md).
- Keep all four Rosetta results and their original evidence accessible.

## Recorded package version

| Version | First recorded in package.json | Source |
| --- | --- | --- |
| **0.2.0** | 2026-08-17 | [b003eeb](https://github.com/AnnonyA/Luau-decompiler/blob/b003eebdc55657047b77a46382e7a3d56b1948b4/package.json) |

The same version is present in the [2026-08-19 package](https://github.com/AnnonyA/Luau-decompiler/blob/07baba62e96d7568265ad6bd850c70cd34424823/package.json)
and the current checkout. The **v0.3.0** wording in older
[benchmark planning notes](benchmarks/README.md) is an explicitly unreleased
target, not a published package or release documented here.

## Development milestones

| Date | Change | Recorded commit |
| --- | --- | --- |
| 2026-11-27 | Improved source reconstruction while retaining all-pass Quick, Full, Hard Quick and Hard Full; source similarity reached 76.93%, 73.91%, 76.39% and 73.53% respectively. | [d2f4ecd — PR #83](https://github.com/AnnonyA/Luau-decompiler/commit/d2f4ecd18b8231b6ad6143c36fee3bf57a1e31f2) |
| 2026-11-27 | Reached all-pass behavioral coverage across all four pinned Rosetta 3 tiers. | [dc4d32d — PR #82](https://github.com/AnnonyA/Luau-decompiler/commit/dc4d32d0c38b881006c04b8c20d72549f420aeed) |
| 2026-11-22 | Added Roblox signature inference from the pinned Creator Hub catalog. | [cec71fb — PR #78](https://github.com/AnnonyA/Luau-decompiler/commit/cec71fbc8cbef575cddc80d8bae665bf53752e9f) |
| 2026-10-28 | Recovered proven numeric O2 helper calls and reduced large-corpus decompilation cost. | [71203a3 — PR #64](https://github.com/AnnonyA/Luau-decompiler/commit/71203a3bf7f9ef0d4c7cdc3be25082da61530ca8) |
| 2026-10-24 | Improved control flow, scopes and effects across two large-system cohorts. | [fea0780 — PR #59](https://github.com/AnnonyA/Luau-decompiler/commit/fea0780cb0abb5725e29c41da18d2f5e99988cad) |
| 2026-10-21 | Added the static browser playground and GitHub Pages deployment. | [e5ea0d6](https://github.com/AnnonyA/Luau-decompiler/commit/e5ea0d6288b1c8a7103d85abb3596f188fdb6737) |
| 2026-08-19 | Improved naming, types, AST cleanup and the decompile API. | [07baba6](https://github.com/AnnonyA/Luau-decompiler/commit/07baba62e96d7568265ad6bd850c70cd34424823) |
| 2026-08-17 | Implemented the version-aware TypeScript bytecode decompiler pipeline. | [b003eeb](https://github.com/AnnonyA/Luau-decompiler/commit/b003eebdc55657047b77a46382e7a3d56b1948b4) |

See the [full Git history](https://github.com/AnnonyA/Luau-decompiler/commits/main/)
for individual fixes and the [benchmark catalog](benchmarks/README.md) for
historical measurements. Original reports, bytecode and failure evidence remain
in their existing locations.
