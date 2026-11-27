local calls: number = 0

local function make(tag: number)
    calls += 1
    local value = tag
    return function(value2, ...)
        value += 1
        return value, value2, select("#", ...), ...
    end
end

local value = (true and make)(7)
local second = (true and make)(17)

local function __index(_, key)
    calls += 100
    return if key == "first" then value else second
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
(true and observe)("first", (true and first)((true and arguments)()));
(true and observe)("second", (true and proxy.second)((true and arguments)()));
(true and observe)("again", value((true and arguments)()))
print("calls", calls, not (value ~= second))

local function pick(value)
    calls += 1000
    return value, second
end;

(true and observe)("one callee", (true and pick)(value)((true and arguments)()))

local function protected()
    return (true and pick)(false)((true and arguments)())
end

local okFalse, errorFalse = pcall(protected)

local function protected2()
    return (true and pick)(nil)((true and arguments)())
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
