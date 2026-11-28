local events = {}
local token = {}
local calls = 0
local saved = {}

local function produce(value)
    calls += 1
    events[#events + 1] = "produce"
    local snapshot = calls
    saved[#saved + 1] = function() return snapshot end
    return value, nil, token
end

local function fromComparison(input, value)
    return if input == true then produce(value) else false
end

local function toComparison(input, value)
    return if input == true then true else produce(value)
end

local function fromUnknown(input, value)
    return if input then produce(value) else false
end

local function toUnknown(input, value)
    return if input then true else produce(value)
end

local function invertedAnd(input, value)
    return if input then false else produce(value)
end

local function invertedOr(input, value)
    return if input then produce(value) else true
end

local function observe(value)
    if value == token then return "token" end
    if value == nil then return "nil" end
    if value == false then return "false" end
    if value == true then return "true" end
    return tostring(value)
end

local inputs = {{false}, {nil}, {true}, {0}, {""}, {token}}
local values = {{false}, {nil}, {true}, {0}, {token}}
local selectors = {fromComparison, toComparison, fromUnknown, toUnknown, invertedAnd, invertedOr}
for _, row in inputs do
    for _, result in values do
        for _, selector in selectors do
            local before = calls
            local value = selector(row[1], result[1])
            print(observe(value), calls - before)
            print("arity", select("#", selector(row[1], result[1])))
        end
    end
end

local nan = 0 / 0
local function less(left, right, value)
    return if left < right then false else produce(value)
end
local function lessEqual(left, right, value)
    return if left <= right then produce(value) else true
end
print("nan", observe(less(nan, 1, token)), observe(lessEqual(nan, 1, false)))

local mt = {
    __eq = function(left, right)
        events[#events + 1] = "eq"
        return left.key == right.key
    end,
    __lt = function(left, right)
        events[#events + 1] = "lt"
        return left.key < right.key
    end,
}
local a = setmetatable({key = 1}, mt)
local b = setmetatable({key = 2}, mt)
local function selectedEquality(left, right)
    return if left == right then produce(token) else false
end
print("meta", observe(selectedEquality(a, b)), observe(less(a, b, token)))
local function adjusted(callback, condition)
    return if condition == true then callback() else false
end
local function none()
    events[#events + 1] = "none"
    local parameters, variadic = debug.info(2, "a")
    print("frame", parameters, variadic)
end
local function many()
    events[#events + 1] = "many"
    return nil, token, false
end
print("none", select("#", adjusted(none, true)), observe(adjusted(none, true)))
print("many", select("#", adjusted(many, true)), observe(adjusted(many, true)))
local total = 0
for _, reader in saved do total += reader() end
print("captured", #saved, total)
print("events", table.concat(events, ","))
