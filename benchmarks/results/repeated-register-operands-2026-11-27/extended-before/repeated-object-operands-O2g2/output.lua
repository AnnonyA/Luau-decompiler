-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:48:07Z
-- Luau bytecode version: 14 | Luau type version: 3

local calls: number = 0
local data = {}
data.__add = function(left, right)
    print("add identity", (rawequal(left, right)))
    return 17
end

data.__lt = function(left, right)
    print("less identity", (rawequal(left, right)))
    return (rawequal(left, right))
end

data.__eq = function(left, right)
    print("equal callback", (rawequal(left, right)))
    return false
end

data.__index = function(object, key)
    print("index identity", (rawequal(object, key)))
    return 23
end

data.__newindex = function(object, key, value)
    print("store identity", rawequal(object, key), (rawequal(object, value)))
    rawset(object, key, value)
end

local function field()
    calls += 1
    return setmetatable({}, data), nil, "tail", nil
end

local list = { field }
local value = (if true then list[1] else nil)()
value += value
print("sum", value, calls)
local value2 = (if true then list[1] else nil)()
value2 = value2 < value2
print("less", value2, calls)
local value3 = (if true then list[1] else nil)() == (if true then list[1] else nil)()
print("equal", value3, calls)
local value4 = (if true then list[1] else nil)()
local value5 = value4[value4]
print("lookup", value5, calls)
local value6 = (if true then list[1] else nil)()
value6[value6] = value6
print("stored", calls)

local function observe(...)
    print("arity", select("#", ...))
    local first, value2, value3, value4 = ...
    print("pack", type(first), not (value2 ~= nil), value3, value4 == nil)
end;

(if true then observe else nil)((if true then list[1] else nil)())
print("closed counter", calls)
