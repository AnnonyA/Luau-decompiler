# Roblox callback type evidence

The offline type lookup covers the following operations in a standard Roblox environment.
The receiver in each row is part of the evidence. A script can give a user-defined table
any of these member names.

| Operation | Luau type information | Roblox reference |
| --- | --- | --- |
| `game:GetService("Players")` | The literal service class is `Players`. | [GetService](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine/classes/ServiceProvider.yaml), [Players](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine/classes/Players.yaml) |
| `Players.PlayerAdded` | The callback receives one `Player`. | [Players](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine/classes/Players.yaml), [RBXScriptSignal](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine/datatypes/RBXScriptSignal.yaml) |
| `Player.DisplayName` | `string` | [Player](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine/classes/Player.yaml) |
| `Player.UserId` | The engine declares `int64`. The scripting API exposes `number`. | [Player](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine/classes/Player.yaml), [Luau-facing signature](https://create.roblox.com/docs/reference/engine/classes/Player#UserId) |
| `Player:GetFullName()` | The inherited zero-argument method returns one `string`. | [Player](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine/classes/Player.yaml), [Instance](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine/classes/Instance.yaml) |

These TypeScript lookups were written for this project from individual API facts in
Roblox Corporation's Creator Documentation at `a23352b27af917e55e165e4d42583580700d1fbf`.
Roblox licenses its prose under CC BY 4.0 and its code samples under MIT. The
lookup contains no upstream prose, samples or generated dump.
[Documentation license](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/LICENSE), [sample license](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/LICENSE-CODE).

Tovek's local naming pass uses an event spelling to suggest a callback parameter name
and uses combinations of field reads to suggest player-related names. A name hint
alone cannot establish a Roblox receiver type. The type lookup and its use in this
project were implemented independently.
[Tovek naming pass](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/ast/src/name_locals.rs#L2553),
[field-use hints](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/ast/src/name_locals.rs#L4390), [MIT license](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/LICENSE.txt).

Luau's compiler emits a receiver register and a method key for a namecall. Its VM can
dispatch through tables or a namecall metamethod. The opcode and method key therefore
do not by themselves establish which engine method ran.
[Compiler](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/Compiler.cpp#L1588),
[VM](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/VM/src/lvmexecute.cpp#L920), [MIT license](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/LICENSE.txt).

## Regression fixture

The [fixture](../../tests/fixtures/rewrites/player-callback-helper.luau) was compiled with
Luau 0.743 using `--binary -g2` at each optimization level. In `functions` mode
the baseline at `8847d23` recovered zero of the seven annotations below.

| Optimization | Callback parameter | Helper parameter | Helper return |
| --- | --- | --- | --- |
| O0 | `Player` | `Player` | `string` |
| O1 | `Player` | `Player` | `string` |
| O2 | `Player` | Unknown | Unknown |

O2 replaces the helper call with a property read inside the callback. The two
unknown slots belong to the retained helper with no remaining caller. Running
the original and each reconstruction with a mock signal that invokes the callback
for Ada and Lin produced the same service lookup, connection and two printed
names in all nine combinations of optimization and annotation mode.
