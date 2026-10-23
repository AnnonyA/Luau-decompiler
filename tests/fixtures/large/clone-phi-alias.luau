local function copy(input)
    local output = {}
    for key, value in pairs(input) do output[key] = value end
    return output
end
local function clone(input)
    local output = copy(input)
    output.attrs = copy(input.attrs)
    return output
end
local function change(state, revision)
    local current = state.current
    if current.version ~= revision then
        current = clone(current)
        current.version = revision
        state.current = current
    end
    current.attrs.count += 1
    return current
end
for _, revision in ipairs({1, 2, 4}) do
    local original = {version = 1, label = 'item', attrs = {count = 3}}
    local state = {current = original}
    local result = change(state, revision)
    print(result.label, result.version, result.attrs.count, original.attrs.count, result == original)
end
