-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:48:06Z
-- Luau bytecode version: 14 | Luau type version: 3

local sharedCounter: number = 0

local function __add(p, p2): number
    print("add identity", rawequal(p, p2))
    return 17
end

local tbl = {}
tbl["__add"] = __add

local function __lt(p, p2)
    print("less identity", rawequal(p, p2))
    return rawequal(p, p2)
end

tbl["__lt"] = __lt

local function __eq(p, p2): boolean
    print("equal callback", rawequal(p, p2))
    return false
end

tbl["__eq"] = __eq

local function __index(p, p2): number
    print("index identity", rawequal(p, p2))
    return 23
end

tbl["__index"] = __index

local function __newindex(a, b, c)
    print("store identity", rawequal(a, b), rawequal(a, c))
    rawset(a, b, c)
end

tbl["__newindex"] = __newindex

local function field()
    sharedCounter += 1
    return setmetatable({}, tbl), nil, "tail", nil
end

local list = { field }
local value = (if true then list[1] else nil)() + (if true then list[1] else nil)()
print("sum", value, sharedCounter)
local result = (if true then list[1] else nil)() < (if true then list[1] else nil)()
print("less", result, sharedCounter)
local result2 = (if true then list[1] else nil)() == (if true then list[1] else nil)()
print("equal", result2, sharedCounter)
local value2 = (if true then list[1] else nil)()[(if true then list[1] else nil)()]
print("lookup", value2, sharedCounter);
(if true then list[1] else nil)()[(if true then list[1] else nil)()] = (if true then list[1] else nil)()
print("stored", sharedCounter)

local function observe(...)
    print("arity", select("#", ...))
    local first, value, value2, value3 = ...
    print("pack", type(first), not (value ~= nil), value2, value3 == nil)
end;

(if true then observe else nil)((if true then list[1] else nil)())
print("closed counter", sharedCounter)
