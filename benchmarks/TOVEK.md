# Pinned Tovek public inputs

The lock selects both directories requested by the user at revision
[`77edf387bf280a2f4d46d57ac85d5c4f071b763f`](https://github.com/Kiet1308/Tovek/tree/77edf387bf280a2f4d46d57ac85d5c4f071b763f):
`docs/assets/v26/tovek/samples` and `luau-lifter/tests/fixtures`.
It verifies all selected files by size and Git blob hash before measurement and
rejects extra bytecode inputs. The original bytes are never recompiled or changed.

There are 47 inputs: six raw web samples and one Roblox Base64 transport, all
version 14, plus 40 lifter fixtures using versions 9, 11 and 13. The v13
`events_shared_return` fixture uses Roblox opcode encoding. Versions are measured
from bytes, not inferred from the directory name.

With a checkout of that revision available locally:

```sh
npm run build
npm run bench:tovek -- --corpus /path/to/Tovek \
  --luau-compile /path/to/luau-compile --luau /path/to/luau \
  --output /tmp/tovek-report
```

The runner reuses `bench-compare` and `competition/evaluate`; it makes no network
or competitor API requests. It writes JSON/Markdown, hashes, timing, reconstructed
sources, syntax results and optional observations of paired fixture sources.
Any decode/parser/AST error or observed mismatch makes the command exit nonzero.
No successful parse is labeled semantic MATCH.

Paired-source observations use the current official VM, not direct execution of
the old bytecode. Known O1 fixtures retain that source optimization setting; other
observations use O2. Legacy compiler revisions and feature flags differ, so these
observations are triage evidence, not proof of bytecode equivalence. A source that
needs Roblox, returns an unexercised module, or produces no trace is NO MEDIDO.
The public web modules require Roblox dependencies and are syntax-only here.

Sources and bytecode are not vendored. Tovek's MIT license and the sample index
identify additional MIT and Apache-2.0 origins, with per-project license files.
The lock includes those notices. Consult the upstream sample index before
redistributing any source or reconstructed output. Benchmark reports record
measurements, not a claimed Tovek engine execution or competitive ranking.
