# Remaining recovery of inlined function regions

Status: read-only investigation, 2026-11-27. No engine change, new benchmark,
runtime replay, or candidate gain is part of this note.

The **82.2% and 90% source-similarity targets remain unmet in this iteration**.
The measured release results are recorded separately. The observations below
identify a substantial remaining source of expansion; they neither establish
that those targets are impossible on this corpus nor promise that the proposed
work will reach them.

## Conclusion

The largest retained opportunity inspected here is reconstruction of complete
regions copied from existing helpers by O2. The copies contain branches,
loops, property accesses, calls, and sometimes captured writes. They are
outside the current primitive-expression and bounded-write matcher.

There is enough incidence to make a gain of one global Quick percentage point
plausible **if** many of these regions can be recovered safely. No small
extension examined here both establishes that gain and discharges the current
arity, frame, environment, capture, and evaluation-order obligations. In
particular, expanding `scalar()` to admit more result types does not address
the main population.

The appropriate next experiment would be isolated region-template matching
with explicit safety certificates. It should preserve the proven engine as a
baseline and reject unresolved regions. This is pending design work, not an
implemented transformation or a partially implemented feature.

## Provenance and scope of the observations

The local revisions below were published with identical Git trees as
`f9543bbb26615f50aa599cead318beb0f9a6e7a0` (326d85e) and
`eca5d23168f56c2c96dce10817ffe2165e55959c` (850211e).
[Compact archived measurements](../../benchmarks/results/remaining-inline-recovery-2026-11-27/README.md)
retain the family metrics and helper census without duplicating the full caches.

The engine reviewed was
[`326d85ed21c0a7bef6dcd07a26e38b49f0148a84`](https://github.com/AnnonyA/Luau-decompiler/tree/f9543bbb26615f50aa599cead318beb0f9a6e7a0).
Quality aggregation uses the already existing diagnostic cache of
[`850211e4d011ea8610ccee2f7262f93b8fc94191`](https://github.com/AnnonyA/Luau-decompiler/tree/eca5d23168f56c2c96dce10817ffe2165e55959c),
not a fresh run of the final engine. That cache records 882 Quick profiles,
empty query/options, and JavaScript-tree SHA-256
`53b3069aeabfce2817993d4f09f3c59306426ae57bd1ba00546ecb0b28e62d74`.
Its summary explicitly labels the replay `behaviorVerified: false`; this note
does not convert those cached quality scores into a behavioral validation.

All workspace paths below are relative to
`/workspace/scratch/eb5e4be57451/`:

- Cache and summary: `similarity-probes/pre-transparent-850/records/` and
  `similarity-probes/pre-transparent-850/summary.json`.
- Earlier helper-body census:
  `quality-research/inline-opportunities-f60a031.json`, produced for engine
  `f60a0310ab8ef11814342d863523c8b0a5cbebbd` by
  `quality-research/inline-opportunity-census.mjs`.
- Supporting earlier interpretation:
  `quality-research/inline-opportunities.md`. Its initial census describes 89
  bodies; this note uses the later **91-body f60 census** explicitly.
- Original bytecode inspected directly:
  `quality-research/baseline/records/quick/cases/nested_inlining/O2g2.luauc`.
- Representative source/output pair:
  `similarity-probes/pre-transparent-850/records/cases/nested_inlining/O2g2.json`.

The compiler and reference repositories were inspected at these immutable pins:

- Rosetta: `80f3c13ce48dc3318d5d49f54958f580937ca8aa`. The cached metrics use its
  original normalized-token similarity and size calculation; this work did
  not change the corpus, profiles, scoring, or deadlines.
- Official Luau CI pin:
  [`9d7748a4f324213a18cb8283fa2a77c330225fa0`](https://github.com/luau-lang/luau/tree/9d7748a4f324213a18cb8283fa2a77c330225fa0).
- Official Luau 0.747 pin used by the diagnostic runtime:
  [`c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`](https://github.com/luau-lang/luau/tree/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f).
- Tovek:
  [`ce2ea3325547fa3896f274b68013386338039040`](https://github.com/Kiet1308/Tovek/tree/ce2ea3325547fa3896f274b68013386338039040).
  `LICENSE.txt` is MIT, copyright Jujhar Singh and Mathias Pedersen (2024).
  This was reference inspection only; no implementation was copied or adapted.

Original source is used only to explain the output-quality gap. Source text,
case names, mutation labels, expected answers, and these diagnostic counts are
not inputs proposed for an engine heuristic.

## Incidence and conditional scale

The cached Quick selection contains the `nested_inlining` case and 40 mutants
whose recorded source provenance names that parent. Their two O2 profiles
give **82 profiles from 41 sources**:

| Quantity from the 850 cache | Value |
| --- | ---: |
| Affected family profiles / all Quick profiles | 82 / 882 |
| Arithmetic mean similarity | 67.84881382453733% |
| Geometric mean token-size ratio | 1.5100154957779586 |
| Share of the global Quick mean | 9.297052154195011% |

These are family-incidence measurements, not counts of proved recoverable
sites. Mutation changes can invalidate a template or its safety proof.

If only these 82 profiles improve and the other 800 remain identical, a mean
family improvement of `882 / 82 = 10.75609756097561` percentage points would
add one global Quick percentage point. The family mean would then be about
78.6049%. This arithmetic demonstrates sufficient potential weight; it does
not estimate how many sites a safe implementation will accept. It also makes
no extrapolation to Full or Hard Full.

The main remaining copies are from `matches`/`hasName`, `resolveHost`,
`segmentFor`, and `pick`. Later private-logical-return recovery addresses a
different, smaller terminal value pattern in `enabled`.

## Concrete AST shapes and bytecode evidence

One retained copy, shortened to show the relevant shape, is:

```luau
local names, name = schema.name, value.name
local result
if type(names) == "table" then
    result = false
    for _, item in names do
        if item == name then
            result = true
            break
        end
    end
else
    result = if type(names) == "string" then names == name else false
end
```

The corresponding retained helper has two parameters and returns a single
boolean on every path. Replacing this region with a call is a matching
opportunity, but its property snapshots, iterator behavior, comparisons and
call frame still need a proof. The existing expression matcher deliberately
does not treat that whole region as a primitive expression.

Direct decoding of the sealed `nested_inlining/O2g2` bytecode gives:

| Retained prototype | Arity encoded by all its RETURNs | Relevant operations | Recorded upvalues |
| --- | --- | --- | --- |
| `resolveHost`, id 1 | One value, B=2 | GETTABLEKS, NAMECALL, CALL | flags, urls, layers |
| `fetchIcons`, id 2 | Open final pack, B=0 | Copied host region, NAMECALL, CALL | flags, urls, layers |
| `hasName`, id 3 | One value, B=2 | FASTCALL1, CALL, FORGPREP, FORGLOOP, comparisons | None |
| `matches`, id 4 | One value, B=2 | GETTABLEKS and the copied search region | None |
| `supported`, id 5 | One value, B=2 | GETUPVAL, GETTABLEKS, branch | vr, flags |
| `enabled`, id 6 | One value, B=2 | Copied getter region and truthiness branches | vr, flags |
| `segmentFor`, id 8 | One value, B=2 | GETTABLEKS, FORGPREP, FORGLOOP, NAMECALL, CALL | None |
| `pathOf`, id 9 | Open final pack, B=0 | Copied segment region, table operations, calls | None |
| `pick`, id 10 | Zero values, B=1 | FASTCALL2, CALL, GETUPVAL, SETUPVAL | picks, misses |
| `onInput`, id 11 | Zero values, B=1 | Copied pick region and captured writes | picks, misses |

These bytecode facts show several concrete obligations:

- `pathOf` and `segmentFor` have no upvalues. A surviving call from the former
  to the latter would introduce a helper capture. Their current zero-upvalue
  closure identity is not preserved merely because the returned values look
  equivalent.
- `fetchIcons` captures `flags`, `urls`, and `layers`; replacing its copied
  region with `resolveHost()` changes its capture inventory unless native
  inlining eliminates the new call and its helper reference again.
- Likewise, restoring `hasName` inside `matches` introduces a helper reference
  into a function whose retained prototype currently has no upvalues.
- Generic iteration, table reads, comparisons of unknown values, method calls,
  and captured writes can observe effects. A new call frame, changed argument
  snapshots, or a different function environment cannot be dismissed as
  presentation alone.
- Scalar helper returns must not be confused with the open final packs of
  `fetchIcons` or `pathOf`. A region replacement needs its own explicit output
  slot and arity contract.

The current line-overlap admission function returns helper definition lines
30, 42, 72, 82, 97 and 107 for this bytecode. Its evidence-opcode set is mostly
arithmetic/comparison based, so even retained copies such as `resolveHost`
and `supported` are not admitted by that mechanism. Broadening admission
would still not prove any rewrite safe.

## Why primitive result extensions are insufficient here

The earlier f60 census contains 91 potential primitive helper bodies across
294 O2 profiles: 54 include string/nil results and 63 have zero arguments;
these categories overlap. Only **two helper-body/profile entries** pass the
existing line-overlap admission: `control_flow/classify` in O2g1 and O2g2.
They are not certified call-site matches. In particular, the inspected caller
uses a generic-for value that the current numeric-argument proof does not
establish as numeric.

The corresponding two complete profiles both score 82.59109258651733% in the
850 cache. Under the current census/admission scope, even making both entire
profiles score 100% would improve the 882-profile mean by at most:

```text
2 * (100 - 82.59109258651733) / 882 = 0.03947598052943915 percentage points
```

This is an upper bound on that limited observed population, not a claim that
all possible future primitive analysis is bounded by it. It rules out treating
the already identified string/nil or zero-argument extension as a demonstrated
one-point solution.

## Proposed isolated work and required gates

The present
[`InlineRecovery.ts`](https://github.com/AnnonyA/Luau-decompiler/blob/f9543bbb26615f50aa599cead318beb0f9a6e7a0/src/reconstruct/InlineRecovery.ts)
implements primitive expression/tuple matching and bounded write regions.
Relevant existing components are `InlineWrites.ts`, `NumericState.ts`,
`analysis/Bindings.ts`, SSA construction, bytecode line metadata, and register
budget accounting. `ClosureInlineRecovery.ts` is a reference for a deliberately
small native-inline contract, not a blanket authorization to reuse that path
for arbitrary helper bodies.

An isolated future design could introduce a separate region-template module
and a separate proof object consumed by recovery. The names of such modules
are design choices; they do not exist as a candidate in this investigation.
Before integration it would need:

1. **Retained-template and region evidence.** Resolve a preceding, stable helper
   by lexical/prototype identity. Match complete bounded regions, including
   control exits, locals, and stores. Line overlap only admits candidates;
   ambiguous helpers or boundaries decline.
2. **Argument and effect order.** Preserve each input's SSA value and evaluation
   point. Reject missing arguments erased by folding rather than inventing
   them. Account for table/property snapshots, aliases, mutable cells and
   callbacks before moving any read into an argument or helper body.
3. **Exact result contract.** Begin with one-value or zero-value regions with
   every exit proved. Open calls, varargs, nil-bearing packs and partial result
   use need separate rules. Replacing one scalar expression must not expand an
   open tail.
4. **Frames, environments and captures.** Either prove the helper body cannot
   observe a surviving additional frame or different environment/capture
   arrangement, or supply a conservative certificate that the emitted call
   must inline under the supported compiler contract and preserve native
   closure ownership. The latter certificate is not implemented. A prior
   inlined copy or setting `inlineForIdentity` is not sufficient evidence.
5. **Compiler constraints.** Check both pins' optimization, variadic/self,
   getfenv/setfenv, cost-model, register, recursion/depth and return-shape gates.
   The reconstructed AST can have a different cost from the original source.
   Globally forcing optimization level 2 is not a substitute for these proofs
   and is not proposed here.
6. **Independent controls before corpus measurement.** Authored fixtures should
   cover value/REF captures, callback and metamethod frame observations,
   function environments, argument mutation, nil holes and zero results,
   nested loop exits, aliases, closure identity, and a deliberately refused
   inline threshold/register case. Preserve original sources and bytecodes,
   run O0/O1/O2 and Hard comparisons where applicable, then execute the
   unchanged four Rosetta release suites and exact quality metric. The
   existing final engine remains the baseline.

No safety claim is based on absence of a `debug.info` spelling in a source
file alone. Unknown callbacks or method/metamethod paths require their own
analysis. No benchmark source, case identifier, inferred original argument, or
generator-specific parenthesis rule is part of this proposal.

## Reference details

The actual compiler implementations inspected are
[Compiler.cpp at 9d](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/Compiler.cpp)
and
[Compiler.cpp at c875](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/Compiler.cpp),
especially `compileFunction`, `getFunctionExpr`, `tryCompileInlinedCall`, and
`compileInlinedCall`. Both exclude variadic functions from the ordinary
compile-time inlining gate and apply further call-site checks. The latter
function also substitutes argument initializers while compiling an inlined
body, which matters to nested literal/call recognition.

The inspected Tovek files are
[deinline.rs](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/deinline.rs),
[deinline/evidence.rs](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/deinline/evidence.rs),
and
[deinline_safety.rs](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/deinline_safety.rs).
They distinguish line-based admission from exact unification, maintain capture
and call-graph facts, and contain explicit `dynamic_environment`,
`call_frames_untracked`, and `reads_frames` checks. This describes mechanisms
present in that code; it is not a claim that another project's assumptions or
validation automatically prove an equivalent change safe here.

## Compact evidence hashes

Paths in this table are relative to the workspace root stated above. Full
source/output caches were not copied into this report.

| Evidence file | SHA-256 |
| --- | --- |
| `similarity-probes/pre-transparent-850/summary.json` | `6788e7df7f4e90141a55597dd601b3e4a386bf2d14aca417ee85928c225397ac` |
| `quality-research/inline-opportunities-f60a031.json` | `a0ecc937f90baa7209ec0af405c0dbe3de9312d5c98eecbe5b731ae29642dddc` |
| `quality-research/inline-opportunity-census.mjs` | `30080d6f807efc17aac8a7f90be29939715f1d96e1c085a2111df30bcbd75665` |
| `quality-research/inline-opportunities.md` | `d4628370fc4a1c489844ea3f9d0680da983f6aa5cb596d249c4cc7b4317092b0` |
| `quality-research/baseline/records/quick/cases/nested_inlining/O2g2.luauc` | `f63c210748b9b42f1bf35f4a0b2fb775975e28971a5f36fe724f5192afca50b4` |
| `similarity-probes/pre-transparent-850/records/cases/nested_inlining/O2g2.json` | `7832efa96271f12a7caa9b377db10a72f6e924335c2b5d55ffd75f9dd90ae63d` |
| `similarity-probes/pre-transparent-850/records/cases/control_flow/O2g1.json` | `a09d336bb0a7b7a079c42a4d511f902b88cd9dc9906ed998fd6c015125d7149f` |
| `similarity-probes/pre-transparent-850/records/cases/control_flow/O2g2.json` | `84051cc04cd55367869f42625c86714df66dd4abbeb39387c6d5e16cf1cc3d61` |

The sorted 82-record manifest has SHA-256
`61c89b516079e2a28c4f9caa1415a6abe1dd179f0dee6fa5e6ed684eda233e39`.
Each manifest line is `relativeRecordPath + NUL + SHA256(recordBytes) + LF`;
paths are relative to `similarity-probes/pre-transparent-850/records/`.

The following read-only aggregation reproduces the family counts, mean,
geometric ratio, two-profile upper bound and manifest digest from the existing
cache. It does not decompile, execute programs, or run the scorer:

```python
import hashlib
import json
import math
import re
from pathlib import Path

root = Path("/workspace/scratch/eb5e4be57451")
records = root / "similarity-probes/pre-transparent-850/records"
rows = []
for section in ("cases", "mutants"):
    for path in sorted((records / section).glob("*/O2g*.json")):
        data = json.loads(path.read_text())
        if (path.parent.name == "nested_inlining" or
                re.search(r" of nested_inlining:", data["source"].splitlines()[0])):
            rows.append((path, data))

assert len(rows) == 82
print("profiles", len(rows))
print("sources", len({(p.parent.parent.name, p.parent.name) for p, _ in rows}))
print("similarity_percent", sum(d["quality"]["similarity"] for _, d in rows) * 100 / len(rows))
print("geometric_token_ratio", math.exp(sum(math.log(d["quality"]["size"]) for _, d in rows) / len(rows)))
manifest = "".join(
    p.relative_to(records).as_posix() + "\0" +
    hashlib.sha256(p.read_bytes()).hexdigest() + "\n"
    for p, _ in sorted(rows)
)
print("manifest_sha256", hashlib.sha256(manifest.encode()).hexdigest())
scores = [json.loads((records / "cases/control_flow" / (profile + ".json")).read_text())
          ["quality"]["similarity"] * 100 for profile in ("O2g1", "O2g2")]
print("two_profile_upper_bound_pp", sum(100 - score for score in scores) / 882)
```
