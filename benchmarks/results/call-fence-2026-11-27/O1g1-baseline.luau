local sharedCounter: number = 0

local function make(p: number)
    sharedCounter += 1
    local calls = p
    return function(p, ...)
        calls += 1
        return calls, p, select("#", ...), ...
    end
end

local callback = (if true then make else nil)(7)
local value = (if true then make else nil)(17)

local function __index(p, p2)
    sharedCounter += 100
    return if p2 == "first" then callback else value
end

local tbl = {}
tbl.__index = __index
local value2 = setmetatable({}, tbl)

local function arguments(): (string, nil, string)
    sharedCounter += 10
    return "a", nil, "c"
end

local function observe(p, ...)
    print(p, select("#", ...), ...)
end;

(if true then observe else nil)("first", (if true then value2.first else nil)((if true then arguments else nil)()));
(if true then observe else nil)("second", (if true then value2.second else nil)((if true then arguments else nil)()));
(if true then observe else nil)("again", callback((if true then arguments else nil)()))
print("calls", sharedCounter, not (callback ~= value))

local function pick(p)
    sharedCounter += 1000
    return p, value
end;

(if true then observe else nil)("one callee", (if true then pick else nil)(callback)((if true then arguments else nil)()))

local function protected()
    return (if true then pick else nil)(false)((if true then arguments else nil)())
end

local success, result = pcall(protected)

local function protected2()
    return (if true then pick else nil)(nil)((if true then arguments else nil)())
end

local success2, result2 = pcall(protected2)
print("errors", success, result:find("boolean") ~= nil, success2, result2:find("nil") ~= nil, sharedCounter)
local sharedCounter2: number = 0

local function increment(p)
    sharedCounter2 += p
    return sharedCounter2, nil, sharedCounter2 + 1
end

local data = { increment = increment };
(if true then observe else nil)("capture", (if true then data.increment else nil)(3));
(if true then observe else nil)("capture again", (if true then data.increment else nil)(4))
print("final", sharedCounter2, sharedCounter)
