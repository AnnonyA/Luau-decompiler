local calls: number = 0

local function make(tag)
    calls += 1
    local value = tag
    return function(value2, ...)
        value += 1
        return value, value2, select("#", ...), ...
    end
end

calls += 1
local value: number = 7

local function function_2(value2, ...)
    value += 1
    return value, value2, select("#", ...), ...
end

calls += 1
local value2: number = 17

local function function_3(value, ...)
    value2 += 1
    return value2, value, select("#", ...), ...
end

local function __index(_, key)
    calls += 100
    return if key == "first" then function_2 else function_3
end

local tbl = {}
tbl.__index = __index
local proxy = setmetatable({}, tbl)

local function arguments(): (string, nil, string)
    calls += 10
    return "a", nil, "c"
end

local function observe(value2, ...)
    print(value2, select("#", ...), ...)
end

local first = proxy.first;
(true and observe)("first", (true and first)((true and arguments)()))
local second = proxy.second;
(true and observe)("second", (true and second)((true and arguments)()));
(true and observe)("again", (true and function_2)((true and arguments)()))
print("calls", calls, not (function_2 ~= function_3))

local function pick(value)
    calls += 1000
    return value, function_3
end

calls += 1000;
(true and observe)("one callee", (true and function_2)((true and arguments)()))

local function protected()
    calls += 1000
    return (false)((true and arguments)())
end

local okFalse, errorFalse = pcall(protected)

local function protected2()
    calls += 1000
    return (nil)((true and arguments)())
end

local okNil, errorNil = pcall(protected2)
print("errors", okFalse, errorFalse:find("boolean") ~= nil, okNil, errorNil:find("nil") ~= nil, calls)
local captured: number = 0

local function increment(amount)
    captured += amount
    return captured, nil, captured + 1
end

local data = { increment = increment };
(true and observe)("capture", (true and data.increment)(3));
(true and observe)("capture again", (true and data.increment)(4))
print("final", captured, calls)
