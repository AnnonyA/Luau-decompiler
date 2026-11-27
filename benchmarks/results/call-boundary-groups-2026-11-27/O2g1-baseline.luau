local sharedCounter: number = 0

local function make(p)
    sharedCounter += 1
    local calls = p
    return function(p, ...)
        calls += 1
        return calls, p, select("#", ...), ...
    end
end

sharedCounter += 1
local sharedCounter2: number = 7

local function function_2(p, ...)
    sharedCounter2 += 1
    return sharedCounter2, p, select("#", ...), ...
end

sharedCounter += 1
local sharedCounter3: number = 17

local function function_3(p, ...)
    sharedCounter3 += 1
    return sharedCounter3, p, select("#", ...), ...
end

local function __index(p, p2)
    sharedCounter += 100
    return if p2 == "first" then function_2 else function_3
end

local tbl = {}
tbl.__index = __index
local value = setmetatable({}, tbl)

local function arguments(): (string, nil, string)
    sharedCounter += 10
    return "a", nil, "c"
end

local function observe(p, ...)
    print(p, select("#", ...), ...)
end;

(if true then observe else nil)("first", (if true then value.first else nil)((if true then arguments else nil)()));
(if true then observe else nil)("second", (if true then value.second else nil)((if true then arguments else nil)()));
(if true then observe else nil)("again", (if true then function_2 else nil)((if true then arguments else nil)()))
print("calls", sharedCounter, not (function_2 ~= function_3))

local function pick(p)
    sharedCounter += 1000
    return p, function_3
end

sharedCounter += 1000;
(if true then observe else nil)("one callee", (if true then function_2 else nil)((if true then arguments else nil)()))

local function protected()
    sharedCounter += 1000
    return (false)((if true then arguments else nil)())
end

local success, result = pcall(protected)

local function protected2()
    sharedCounter += 1000
    return (nil)((if true then arguments else nil)())
end

local success2, result2 = pcall(protected2)
print("errors", success, result:find("boolean") ~= nil, success2, result2:find("nil") ~= nil, sharedCounter)
local sharedCounter4: number = 0

local function increment(p)
    sharedCounter4 += p
    return sharedCounter4, nil, sharedCounter4 + 1
end

local data = { increment = increment };
(if true then observe else nil)("capture", (if true then data.increment else nil)(3));
(if true then observe else nil)("capture again", (if true then data.increment else nil)(4))
print("final", sharedCounter4, sharedCounter)
