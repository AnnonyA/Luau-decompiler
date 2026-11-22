# Roblox callback type evidence

The CLI and browser ship the same generated catalog. It indexes every class,
datatype and enum YAML file in Roblox Creator Docs at
`a23352b27af917e55e165e4d42583580700d1fbf` (Studio `0.748.0.7481526`).
Inference starts from a known receiver and follows its declared base classes.
A property, method, callback or event on a subclass takes precedence over an
inherited member. [Pinned engine reference](https://github.com/Roblox/creator-docs/tree/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine)

## Coverage

| Source category | Catalog coverage |
| --- | --- |
| Engine classes | 644 classes, including 151 tagged services and 330 non-service classes eligible for construction |
| Class members | 2,379 properties, 1,447 methods, 370 events and 13 callbacks |
| Engine datatypes | 49 datatypes, 171 instance properties, 11 static properties, 82 instance methods and 87 constructor or static function names |
| Enums | 526 enums with 3,059 items |

Member counts represent declarations on their owners. Inheriting a member adds
it to lookup on subclasses without increasing the count. Method counts include
void methods and signatures with a dynamic result. A return annotation requires
all overloads matching the observed argument count to agree on a single
representable result. Tuple and dynamic results stay unknown. A callback with
a dynamic argument pack can still contribute types for its documented fixed
parameters. Generic containers without an element type, ambiguous type names,
and restricted members cannot establish a specific type.

The catalog maps numeric engine types to Luau `number`, qualifies enums,
and keeps potentially absent instances optional. The name of an event alone
provides insufficient evidence. For example, `GuiObject.InputBegan` has one
parameter and `UserInputService.InputBegan` has two.
[GuiObject](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine/classes/GuiObject.yaml),
[UserInputService](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine/classes/UserInputService.yaml).

## Regeneration and attribution

Install the project's development dependencies with `npm ci`. From the root of
this repository, these commands retrieve the pinned input and verify the shipped
file. Omit `--check` on the last line to regenerate it. The generator reads Git
objects at the recorded revision and accepts a local checkout containing that
commit. Decompiling bytecode uses only the bundled data.

```sh
git clone --no-checkout --filter=blob:none --depth=1 https://github.com/Roblox/creator-docs.git ../roblox-creator-docs
git -C ../roblox-creator-docs fetch --depth=1 origin a23352b27af917e55e165e4d42583580700d1fbf
git -C ../roblox-creator-docs sparse-checkout set content/en-us/reference/engine/classes content/en-us/reference/engine/datatypes content/en-us/reference/engine/enums
git -C ../roblox-creator-docs checkout --detach FETCH_HEAD
node scripts/generate-roblox-api.mjs ../roblox-creator-docs --check
```

Source credit belongs to Roblox Corporation and the contributors to Roblox
Creator Docs. Its documentation is licensed under CC BY 4.0. The generator
selects API facts, joins inherited definitions during lookup, normalizes type
and argument information, and omits descriptions and code samples. Roblox
licenses the source code samples separately under MIT.
[Source and documentation license](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/LICENSE),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
[sample license](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/LICENSE-CODE).

## Receiver evidence

| Operation | Luau type information | Roblox reference |
| --- | --- | --- |
| `game:GetService("Players")` | The literal service class is `Players`. | [GetService](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine/classes/ServiceProvider.yaml), [Players](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine/classes/Players.yaml) |
| `Players.PlayerAdded` | The callback receives one `Player`. | [Players](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine/classes/Players.yaml), [RBXScriptSignal](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine/datatypes/RBXScriptSignal.yaml) |
| `Player.DisplayName` | `string` | [Player](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine/classes/Player.yaml) |
| `Player.UserId` | The engine declares `int64`. The scripting API exposes `number`. | [Player](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine/classes/Player.yaml), [Luau-facing signature](https://create.roblox.com/docs/reference/engine/classes/Player#UserId) |
| `Player:GetFullName()` | The inherited zero-argument method returns one `string`. | [Player](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine/classes/Player.yaml), [Instance](https://github.com/Roblox/creator-docs/blob/a23352b27af917e55e165e4d42583580700d1fbf/content/en-us/reference/engine/classes/Instance.yaml) |

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
