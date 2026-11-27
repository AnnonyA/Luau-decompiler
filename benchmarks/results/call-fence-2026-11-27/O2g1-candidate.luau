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

(true and observe)("first", (true and value.first)((true and arguments)()));
(true and observe)("second", (true and value.second)((true and arguments)()));
(true and observe)("again", (true and function_2)((true and arguments)()))
print("calls", sharedCounter, not (function_2 ~= function_3))

local function pick(p)
    sharedCounter += 1000
    return p, function_3
end

sharedCounter += 1000;
(true and observe)("one callee", (true and function_2)((true and arguments)()))

local function protected()
    sharedCounter += 1000
    return (false)((true and arguments)())
end

local success, result = pcall(protected)

local function protected2()
    sharedCounter += 1000
    return (nil)((true and arguments)())
end

local success2, result2 = pcall(protected2)
print("errors", success, result:find("boolean") ~= nil, success2, result2:find("nil") ~= nil, sharedCounter)
local sharedCounter4: number = 0

local function increment(p)
    sharedCounter4 += p
    return sharedCounter4, nil, sharedCounter4 + 1
end

local data = { increment = increment };
(true and observe)("capture", (true and data.increment)(3));
(true and observe)("capture again", (true and data.increment)(4))
print("final", sharedCounter4, sharedCounter)
