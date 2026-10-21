# Controlled semantic corpus: 100 independent programs

Each `.luau` file is a standalone project-owned program. No shared Luau helper
module or external input is loaded. The 21 existing regression programs are
retained and 79 new programs cover different operations and data/control-flow
patterns. O0 and O1 are two compilation profiles of each program, not additional
independent programs. The mandatory matrix contains 200 comparisons.

The official pinned Luau compiler produces bytecode, the decompiler reconstructs
it, and the official VM runs the original and reconstructed source. The runner
compares stdout, stderr and process success. Fixture functions use differing
inputs (including false/nil, zero, negative values and boundary conditions), or
observe multiple steps of a mutation/capture sequence. Errors expected by a
program are caught with `pcall` and traced without unstable file paths.

Table traversal traces use commutative aggregates rather than unspecified key
order. No fixture relies on randomness, time, networking, Roblox services or
printed object addresses. Original and recovered executions are time-limited.

## Coverage

The existing 21 regression files cover arithmetic, branching, while/repeat and
nested loops, closures and mutable captures, recursion, table writes, multireturn,
varargs, evaluation/concatenation order, boolean coercion and string formatting.

The 79 additions are grouped below. Every listed ID links to its complete source.

### Numbers and comparisons (10)

Signed arithmetic, division/floor division, negative modulo, powers and precedence, signed zero, NaN comparisons, mixed-type equality, bit operations and math calls.

- [arithsigns](arithsigns.luau)
- [arithdivision](arithdivision.luau)
- [arithmodulo](arithmodulo.luau)
- [arithpowers](arithpowers.luau)
- [arithprecedence](arithprecedence.luau)
- [arithnegzero](arithnegzero.luau)
- [comparisonnan](comparisonnan.luau)
- [comparisonsmixed](comparisonsmixed.luau)
- [bitwiseops](bitwiseops.luau)
- [mathfunctions](mathfunctions.luau)

### Branches and truthiness (10)

All boolean branch combinations, truthy zero/empty strings, short-circuit values, inclusive/exclusive bounds, elseif ladders, branch assignments, early returns and nil defaults.

- [truthiness](truthiness.luau)
- [booleanreturn](booleanreturn.luau)
- [andorvalues](andorvalues.luau)
- [chainedcomparisons](chainedcomparisons.luau)
- [elseifladder](elseifladder.luau)
- [branchassignments](branchassignments.luau)
- [earlyreturns](earlyreturns.luau)
- [nestedconditions](nestedconditions.luau)
- [nilchecks](nilchecks.luau)
- [loopconditions](loopconditions.luau)

### Loop boundaries and iteration (12)

Empty/single/multiple iterations, ascending/descending/fractional steps, reversed bounds, repeat-body locals, break/continue edges, ipairs with holes and pairs with mixed keys.

- [forascending](forascending.luau)
- [fordescending](fordescending.luau)
- [forsteps](forsteps.luau)
- [forboundaries](forboundaries.luau)
- [whilezero](whilezero.luau)
- [repeatonce](repeatonce.luau)
- [repeatlocals](repeatlocals.luau)
- [breakwhile](breakwhile.luau)
- [continuefor](continuefor.luau)
- [repeatcontinue](repeatcontinue.luau)
- [genericipairs](genericipairs.luau)
- [genericpairs](genericpairs.luau)

### Closures and callbacks (10)

Value snapshots, mutable independent state, sibling setters/getters, per-iteration captures, recursive closures, nested factories, shadowing, mutual recursion and callback packs.

- [closuresnapshot](closuresnapshot.luau)
- [closuremutations](closuremutations.luau)
- [closuresiblings](closuresiblings.luau)
- [closureloop](closureloop.luau)
- [closurerecursive](closurerecursive.luau)
- [closurefactory](closurefactory.luau)
- [closureshadow](closureshadow.luau)
- [closureforward](closureforward.luau)
- [callbackarguments](callbackarguments.luau)
- [callbackreturn](callbackreturn.luau)

### Tables and mutation (10)

Nil holes and explicit arity, fixed versus open final elements, key/value evaluation order, overwrites, aliasing, deletion, lengths, sorting, shallow cloning and freezing.

- [tableholes](tableholes.luau)
- [tablelisttail](tablelisttail.luau)
- [tablekeyorder](tablekeyorder.luau)
- [tableoverwrite](tableoverwrite.luau)
- [tablealias](tablealias.luau)
- [tabledelete](tabledelete.luau)
- [tablelength](tablelength.luau)
- [tablesort](tablesort.luau)
- [tableclone](tableclone.luau)
- [tablefreeze](tablefreeze.luau)

### Calls and return packs (10)

Argument evaluation order, nested side effects, fixed/open argument packs, empty/nil returns, varargs containing nil, method receivers, mutation and protected errors.

- [callorder](callorder.luau)
- [callnested](callnested.luau)
- [callfixed](callfixed.luau)
- [callmultitail](callmultitail.luau)
- [returnempty](returnempty.luau)
- [varargnil](varargnil.luau)
- [varargforward](varargforward.luau)
- [methodself](methodself.luau)
- [methodmutate](methodmutate.luau)
- [protectedcalls](protectedcalls.luau)

### String bytes and operations (10)

Invalid UTF-8 bytes, leading/embedded BOM, control escapes, Unicode code points, pattern matching, numeric formatting, interpolation, concatenation association and byte slicing.

- [stringbinary](stringbinary.luau)
- [stringbom](stringbom.luau)
- [stringcontrols](stringcontrols.luau)
- [stringunicode](stringunicode.luau)
- [stringpatterns](stringpatterns.luau)
- [stringformatnumbers](stringformatnumbers.luau)
- [stringinterpolation](stringinterpolation.luau)
- [stringconcatassoc](stringconcatassoc.luau)
- [stringnumbercoercion](stringnumbercoercion.luau)
- [stringsubbytes](stringsubbytes.luau)

### Bindings and lexical scope (7)

Accumulator reuse, compound reads, table snapshots, local-function binding, shadowed math, global names and captured function fields.

- [localsreuse](localsreuse.luau)
- [compoundread](compoundread.luau)
- [localtablesnapshot](localtablesnapshot.luau)
- [localfunctionbinding](localfunctionbinding.luau)
- [shadowmath](shadowmath.luau)
- [shadowsglobals](shadowsglobals.luau)
- [functionvaluefield](functionvaluefield.luau)

## Observed results and limits

The initial expanded run matched 187 of 200 compilation profiles. After fixing
the defects it exposed, the same 100 programs match all 200 profiles. The fixed
allowlist, matrix size and unique source files are checked by the runner tests.

Passing these selected traces does not establish correctness for all Luau,
all bytecode versions, hostile inputs, all heap states or all source programs.
These are development regressions, not an independent holdout: they informed
the fixes. More fixtures should add new behavior and input conditions, rather
than duplicate a source with different names or constants.

Run the matrix as described in [the benchmark guide](../README.md). The report
records original and bytecode hashes, recovered source, disassembly, raw
reconstruction, execution traces, compiler path and optimization level.
