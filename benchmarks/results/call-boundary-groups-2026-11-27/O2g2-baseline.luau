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
(if true then observe else nil)("first", (if true then first else nil)((if true then arguments else nil)()))
local second = proxy.second;
(if true then observe else nil)("second", (if true then second else nil)((if true then arguments else nil)()));
(if true then observe else nil)("again", (if true then function_2 else nil)((if true then arguments else nil)()))
print("calls", calls, not (function_2 ~= function_3))

local function pick(value)
    calls += 1000
    return value, function_3
end

calls += 1000;
(if true then observe else nil)("one callee", (if true then function_2 else nil)((if true then arguments else nil)()))

local function protected()
    calls += 1000
    return (false)((if true then arguments else nil)())
end

local okFalse, errorFalse = pcall(protected)

local function protected2()
    calls += 1000
    return (nil)((if true then arguments else nil)())
end

local okNil, errorNil = pcall(protected2)
print("errors", okFalse, errorFalse:find("boolean") ~= nil, okNil, errorNil:find("nil") ~= nil, calls)
local captured: number = 0

local function increment(amount)
    captured += amount
    return captured, nil, captured + 1
end

local data = { increment = increment };
(if true then observe else nil)("capture", (if true then data.increment else nil)(3));
(if true then observe else nil)("capture again", (if true then data.increment else nil)(4))
print("final", captured, calls)
