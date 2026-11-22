import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {decompile} from '../src/decompile.ts';

// Locate each callback by its receiver as the fixture deliberately repeats
// event names on unrelated objects. Local parameter spellings may differ.
function signature(source: string, prefix: string) {
  const header = source.split('\n').find(line => line.trimStart().startsWith(prefix + '('));
  if (!header) throw Error('Missing function header: ' + prefix);
  const match = /function(?: \w+)?\(([^)]*)\)(?:: (.+))?$/.exec(header.trim());
  if (!match) throw Error('Unexpected function header: ' + header);
  return {
    params: match[1]!.split(', ').map(param => param.split(': ')[1]),
    result: match[2],
  };
}

const callbacks: Array<[string, Array<string | undefined>]> = [
  ['input.InputBegan:Connect(function', ['InputObject', 'boolean']],
  ['clock.Heartbeat:Once(function', ['number']],
  ['sounds.ChildAdded:Connect(function', ['Instance']],
  ['part.Touched:ConnectParallel(function', ['BasePart']],
  ['players.PlayerAdded:Connect(function', ['Player']],
  ['joined.CharacterAdded:Once(function', ['Model']],
  ['remote.OnServerEvent:Connect(function', ['Player', undefined]],
  ['customSignals.InputBegan:Connect(function', [undefined, undefined]],
  ['fakeClock.Heartbeat:Once(function', [undefined]],
  ['fakePart.Touched:Connect(function', [undefined]],
];

for (const mode of ['functions', 'useful', 'off'] as const) {
  it.each([0, 1, 2])('reconstructs documented and custom signals in ' + mode + ' mode at O%s', level => {
    const bytes = readFileSync(new URL(`./fixtures/rewrites/roblox-service-signatures-O${level}.luauc`, import.meta.url));
    const result = decompile(bytes, {opcodeEncoding: 'official', typeAnnotations: mode});
    if (!result.ok) throw Error(result.error);
    const expectSignature = (prefix: string, params: Array<string | undefined>, ret?: string) => {
      expect(signature(result.source, prefix), prefix).toEqual({
        params: mode === 'off' ? params.map(() => undefined) : params,
        result: mode === 'off' ? undefined : ret,
      });
    };
    for (const [prefix, params] of callbacks) expectSignature(prefix, params);
    // O2 inlines the simple property reads, but retains the IsA call.
    for (const [name, type] of [['positionOf', 'Vector3'], ['keyOf', 'Enum.KeyCode']] as const) {
      expectSignature('local function ' + name, [level < 2 ? 'InputObject' : undefined], level < 2 ? type : undefined);
    }
    expectSignature('local function checkSound', ['Instance'], 'boolean');
    expectSignature('local function showMixed', [undefined]);
  });
}
