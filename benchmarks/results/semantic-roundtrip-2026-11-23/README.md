# Branch-selected closures and evaluation order

These project-authored programs reproduce reconstruction errors on
`cec71fb`. Each original and its decompiled source ran in Luau 0.743 at the
same optimization level. Each cell below counts successful executions with
identical stdout across O0, O1 and O2, each compiled with debug level 0, 1 or 2.

| Fixture | Before | After | Observable behavior |
| --- | ---: | ---: | --- |
| [Branch-selected closure](../../../tests/fixtures/rewrites/branch-selected-closure.luau) | 0/9 | 9/9 | Calling the selected closure twice prints 14, 26, −16 and −33. The previous reconstruction called nil. |
| [Captured counter argument](../../../tests/fixtures/rewrites/captured-cell-argument-order.luau) | 6/9 | 9/9 | A call between two reads increments the counter. The first iteration prints 10, 10, 11. The O2 reconstruction read the first argument after the increment. |
| [Recursive function snapshot](../../../tests/fixtures/rewrites/recursive-closure-snapshot.luau) | 6/9 | 9/9 | A closure replaces itself through a captured variable. A caller holding the old function receives 130 and 261 on the last call. The previous O2 reconstruction returned only 129. |
| [Escaping handler](../../../tests/fixtures/rewrites/selected-handler-factory.luau) | 6/9 | 9/9 | Two returned handlers keep independent balances. The O0 reconstruction lost the selected function. |
| [Indexed assignment](../../../tests/fixtures/rewrites/indexed-read-order.luau) | 0/9 | 9/9 | The values written through the metatable are 21 and 12. Reversing the reads produced 22 and 11. |
| [Indexed read and overloaded addition](../../../tests/fixtures/rewrites/indexed-arithmetic-order.luau) | 0/9 | 9/9 | Swapping the order of `__index` and `__add` changed all four stored values. At g0, two adjacent immediately invoked functions also needed a statement separator. |
| [Short-circuit call](../../../tests/fixtures/rewrites/short-circuit-selected-call.luau) | 3/9 | 9/9 | Five calls occur across truthy, false and nil inputs. O0 and O1 used to call the truthy operand twice. |

The official VM stores a newly created closure in its destination register and
reads tables through a path that can invoke a metamethod. Tovek's lifter also
represents closure creation and indexed reads as instructions assigning their
own result. The fixes here use this project's existing register and branch-join
analysis. [Luau VM](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lvmexecute.cpp#L697)
and [Tovek lifter](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/luau-lifter/src/lifter.rs#L1718).

The official VM regression job runs the fixtures listed in
[`full-debug-profiles.json`](../../../tests/fixtures/full-debug-profiles.json)
at all three optimization and debug levels. It also runs the name-style and
rewrite-option matrices at debug level 1.
