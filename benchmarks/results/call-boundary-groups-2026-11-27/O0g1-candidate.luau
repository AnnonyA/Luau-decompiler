local sharedCounter: number = 0

local function make(p: number)
    sharedCounter += 1
    local calls = p
    return function(p, ...)
        calls += 1
        return calls, p, select("#", ...), ...
    end
end

local callback = (true and make)(7)
local value = (true and make)(17)
local setmetatable2 = setmetatable

local function __index(p, p2)
    sharedCounter += 100
    return if p2 == "first" then callback else value
end

local tbl = {}
tbl["__index"] = __index
local value2 = setmetatable2({}, tbl)

local function arguments(): (string, nil, string)
    sharedCounter += 10
    return "a", nil, "c"
end

local function observe(p, ...)
    print(p, select("#", ...), ...)
end;

(observe)("first", (value2.first)((true and arguments)()));
(observe)("second", (value2.second)((true and arguments)()));
(observe)("again", callback((true and arguments)()))
print("calls", sharedCounter, not (callback ~= value))

local function pick(p)
    sharedCounter += 1000
    return p, value
end;

(observe)("one callee", (true and pick)(callback)((true and arguments)()))
local success, result = pcall(function()
    return (true and pick)(false)((true and arguments)())
end)
local success2, result2 = pcall(function()
    return (true and pick)(nil)((true and arguments)())
end)
print("errors", success, result:find("boolean") ~= nil, success2, result2:find("nil") ~= nil, sharedCounter)
local sharedCounter2: number = 0

local function increment(p)
    sharedCounter2 += p
    return sharedCounter2, nil, sharedCounter2 + 1
end

local data = { increment = increment };
(observe)("capture", (true and data.increment)(3));
(observe)("capture again", (true and data.increment)(4))
print("final", sharedCounter2, sharedCounter)
