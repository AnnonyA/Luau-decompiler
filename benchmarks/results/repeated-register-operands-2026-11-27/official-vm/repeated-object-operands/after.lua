-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:50:11Z
-- Luau bytecode version: 14 | Luau type version: 3

local sharedCounter: number = 0
local data = {}
data.__add = function(p, p2)
    print("add identity", rawequal(p, p2))
    return 17
end

data.__lt = function(p, p2)
    print("less identity", rawequal(p, p2))
    return rawequal(p, p2)
end

data.__eq = function(p, p2)
    print("equal callback", rawequal(p, p2))
    return false
end

data.__index = function(p, p2)
    print("index identity", rawequal(p, p2))
    return 23
end

data.__newindex = function(a, b, c)
    print("store identity", rawequal(a, b), rawequal(a, c))
    rawset(a, b, c)
end

local function field()
    sharedCounter += 1
    return setmetatable({}, data), nil, "tail", nil
end

local list = { field }
local value = (if true then list[1] else nil)()
local value2 = value + value
print("sum", value2, sharedCounter)
local value3 = (if true then list[1] else nil)()
value3 = value3 < value3
print("less", value3, sharedCounter)
local value4 = (if true then list[1] else nil)()
value4 = not (value4 ~= value4)
print("equal", value4, sharedCounter)
local value5 = (if true then list[1] else nil)()
local value6 = value5[value5]
print("lookup", value6, sharedCounter)
local value7 = (if true then list[1] else nil)()
value7[value7] = value7
print("stored", sharedCounter)

local function observe(...)
    print("arity", select("#", ...))
    local first, value, value2, value3 = ...
    print("pack", type(first), not (value ~= nil), value2, value3 == nil)
end;

(if true then observe else nil)((if true then list[1] else nil)())
print("closed counter", sharedCounter)
