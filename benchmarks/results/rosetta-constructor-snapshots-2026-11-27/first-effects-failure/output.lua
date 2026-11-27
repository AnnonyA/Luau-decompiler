-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:03:42Z
-- Luau bytecode version: 14 | Luau type version: 3

local list = {}

local function emit(p, ...)
    list[#list + 1] = p
    return ...
end

local value = ("TAG"):lower()
print(value)
local field = ((if true then emit else nil)("first", "start", "discard"))
local value2 = (if true then emit else nil)("middle", 8, "discard")
print((if true then table.concat else nil)(list, ","))
local value3 = ("LATER"):lower()
print(value3)
local print2 = print

local data = {
    field,
    ["tag"] = value,
    { 7, "nested" },
    value2,
    (if true then emit else nil)("tail", 9, nil, 11),
}

print2(data[1], data.tag, type(data[2]), data[3], data[4], data[5], data[6])
print(data[2][1], data[2][2], (if true then table.concat else nil)(list, ","))
data[2][1] = 13
print(if data ~= data then false else true, data[2][1])
