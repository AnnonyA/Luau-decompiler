local calls: number = 0

local function make(tag: number)
    calls += 1
    local value = tag
    return function(value2, ...)
        value += 1
        return value, value2, select("#", ...), ...
    end
end

local value = (if true then make else nil)(7)
local second = (if true then make else nil)(17)
local setmetatable2 = setmetatable

local function __index(_, key)
    calls += 100
    return if key == "first" then value else second
end

local tbl = {}
tbl["__index"] = __index
local proxy = setmetatable2({}, tbl)

local function arguments(): (string, nil, string)
    calls += 10
    return "a", nil, "c"
end

local function observe(value2, ...)
    print(value2, select("#", ...), ...)
end

local first = proxy.first;
(if true then observe else nil)("first", (if true then first else nil)((if true then arguments else nil)()));
(if true then observe else nil)("second", (if true then proxy.second else nil)((if true then arguments else nil)()));
(if true then observe else nil)("again", value((if true then arguments else nil)()))
print("calls", calls, not (value ~= second))

local function pick(value)
    calls += 1000
    return value, second
end;

(if true then observe else nil)("one callee", (if true then pick else nil)(value)((if true then arguments else nil)()))
local okFalse, errorFalse = pcall(function()
    return (if true then pick else nil)(false)((if true then arguments else nil)())
end)
local okNil, errorNil = pcall(function()
    return (if true then pick else nil)(nil)((if true then arguments else nil)())
end)
print("errors", okFalse, errorFalse:find("boolean") ~= nil, okNil, errorNil:find("nil") ~= nil, calls)
local captured: number = 0

local function increment(amount)
    captured += amount
    return captured, nil, captured + 1
end

local data = { ["increment"] = increment };
(if true then observe else nil)("capture", (if true then data.increment else nil)(3));
(if true then observe else nil)("capture again", (if true then data.increment else nil)(4))
print("final", captured, calls)
