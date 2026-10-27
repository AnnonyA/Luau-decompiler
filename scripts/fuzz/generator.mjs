// A small grammar of authored programs, independent of the benchmark corpus.
// Generation never executes input or uses the host clock/random number source.
export const GENERATOR_VERSION = 1;

export function generateProgram(seed, { extraBlocks = 3 } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw Error('seed must be an unsigned 32-bit integer');
  if (!Number.isInteger(extraBlocks) || extraBlocks < 0 || extraBlocks > 12) throw Error('extraBlocks must be 0..12');
  let state = seed >>> 0;
  const random = n => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) % n;
  };
  const number = () => 1 + random(9);
  const expression = (depth = 2) => {
    if (!depth) return random(2) ? 'input' : String(number());
    const left = expression(depth - 1);
    return `(${left} ${['+', '-', '*', '%'][random(4)]} ${number()})`;
  };
  const features = ['captures', 'aliasing', 'side-effects', 'loops', 'multiple-returns'];
  const chosen = [...features];
  for (let i = 0; i < extraBlocks; i++) chosen.push(features[random(features.length)]);
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }
  const blocks = chosen.map((feature, id) => {
    const label = `${feature}-${id}`;
    let body;
    if (feature === 'captures') {
      body = `local state = ${expression()}
local function step(delta)
    state += delta
    return state
end
local function read()
    return state
end
local before = read()
local after = step(effect("capture-${id}", ${number()}))
emit("${label}", before, after, read(), step(-${number()}), read())`;
    } else if (feature === 'aliasing') {
      body = `local original = {value = ${expression()}, nested = {count = ${number()}}}
local alias = original
local snapshot = alias.value
if input % 2 == 0 then
    alias.nested.count += effect("nested-${id}", ${number()})
else
    original.value += effect("field-${id}", ${number()})
end
local nestedAlias = alias.nested
nestedAlias.count += ${number()}
emit("${label}", alias == original, snapshot, original.value, alias.value, original.nested.count)`;
    } else if (feature === 'side-effects') {
      body = `local total = effect("left-${id}", ${expression()}) + effect("right-${id}", ${expression()})
local choice = input % 2 == 0 and effect("even-${id}", ${number()}) or effect("odd-${id}", ${number()})
local values = {effect("first-${id}", total), effect("second-${id}", choice)}
emit("${label}", total, choice, values[1], values[2])`;
    } else if (feature === 'loops') {
      const limit = 2 + random(4), kind = random(3);
      const statement = `if index % 2 == input % 2 then
    total += effect("loop-${id}", index)
else
    total -= index
end`;
      const loop = kind === 0 ? `for index = 1, ${limit} do
${statement}
end` : kind === 1 ? `local index = 0
while index < ${limit} do
index += 1
${statement}
end` : `local index = 0
repeat
index += 1
${statement}
until index >= ${limit}`;
      body = `local total = ${expression()}
${loop}
emit("${label}", total)`;
    } else {
      body = `local function pack(value)
    effect("pack-${id}", value)
    return value, nil, value + ${number()}, false
end
local function relay(...)
    return select("#", ...), ...
end
local first, hole, third, fourth = pack(${expression()})
emit("fixed-${id}", first, hole, third, fourth)
local values = {pack(${expression()})}
emit("table-${id}", values[1], values[2], values[3], values[4])
emit("${label}", relay(pack(${expression()})))`;
    }
    return `do\n${body.split('\n').map(line => '    ' + line).join('\n')}\nend`;
  });
  const source = `-- semantic-generator-v${GENERATOR_VERSION} seed=${seed}
local input = tonumber(...) or 0
local effects = {}
local function effect(label, value)
    effects[#effects + 1] = label .. ":" .. tostring(value)
    return value
end
local function emit(label, ...)
    print(label, select("#", ...))
    for index = 1, select("#", ...) do
        local value = select(index, ...)
        print(index, tostring(value))
    end
end
${blocks.join('\n')}
print("effects", table.concat(effects, "|"))
`;
  return { seed, generatorVersion: GENERATOR_VERSION, extraBlocks, features, inputs: [['0'], ['1'], ['5']], source };
}
