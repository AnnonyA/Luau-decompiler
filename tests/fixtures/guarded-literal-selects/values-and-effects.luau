-- Authored independently of Rosetta. A one-cell default must stay a scalar,
-- even when the selected producer has no result or a nil-bearing result pack.
local events = {}
local object = {tag = "object"}
local function callback() return "callback" end
local function describe(value)
    if value == object then return "object" end
    if value == callback then return "callback" end
    return tostring(value)
end
local function produce(mode)
    table.insert(events, "produce:" .. mode)
    if mode == 0 then return end
    if mode == 1 then return nil, "extra", false end
    if mode == 2 then return false, true end
    if mode == 3 then return object, "extra" end
    return callback, object, nil
end
local function choose(test, mode)
    local result = false
    if test then
        result = produce(mode)
    end
    return result
end
local function chooseNil(test, mode)
    local result = nil
    if test then
        result = produce(mode)
    end
    return result
end
local function chooseTrue(left, right, mode)
    local result = true
    if left < right then
        result = produce(mode)
    end
    return result
end
local function emit(label, ...)
    local first = ...
    print(label, select("#", ...), describe(first))
end
local inputs = {false, true, 0, "", object, callback}
for _, input in inputs do
    for mode = 0, 4 do
        emit("false-default", choose(input, mode))
        emit("nil-default", chooseNil(input, mode))
    end
end
for mode = 0, 4 do
    emit("nil-test", choose(nil, mode))
    emit("nil-test-default", chooseNil(nil, mode))
    emit("nan", chooseTrue(0 / 0, 1, mode))
    emit("ordered", chooseTrue(-1, 1, mode))
    emit("reversed", chooseTrue(2, 1, mode))
end
local mt = {
    __lt = function(left, right)
        table.insert(events, "compare:" .. left.value .. ":" .. right.value)
        return left.value < right.value
    end,
}
local first = setmetatable({value = 1}, mt)
local second = setmetatable({value = 2}, mt)
emit("meta-yes", chooseTrue(first, second, 3))
emit("meta-no", chooseTrue(second, first, 3))
local reads = 0
local function inspect(entry)
    local result = false
    if entry ~= nil then
        result = entry.ready ~= nil
    end
    return result
end
local entry = setmetatable({}, {__index = function(_, key)
    reads += 1
    table.insert(events, "read:" .. key)
    return false
end})
emit("read-present", inspect(entry))
emit("read-absent", inspect(nil))
print("reads", reads)
print(table.concat(events, ","))
