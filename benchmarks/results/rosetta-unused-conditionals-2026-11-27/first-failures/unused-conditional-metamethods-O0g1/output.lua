-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:10:46Z
-- Luau bytecode version: 14 | Luau type version: 3

local list = {}

local function record(p: string)
    (if true then table.insert else nil)(list, p)
end

local setmetatable2 = setmetatable

local function __lt(p, p2): boolean
    (if true then record else nil)("lt")
    return false
end

local tbl = {}
tbl["__lt"] = __lt

local function __le(p, p2): boolean
    (if true then record else nil)("le")
    return true
end

tbl["__le"] = __le

local function __eq(p, p2): boolean
    (if true then record else nil)("eq")
    return true
end

tbl["__eq"] = __eq
local value = setmetatable2({}, tbl)
local value2 = setmetatable({}, getmetatable(value))
local success, result = pcall(function()
    (if true then record else nil)("before-error")
    local tbl = {};
    (if true then record else nil)("after-error")
end)
print((if true then table.concat else nil)(list, ","), success, type(result))
