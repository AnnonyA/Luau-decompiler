-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:30:27Z
-- Luau bytecode version: 14 | Luau type version: 3

local value
value = nil

local function observe()
    local value2 = value[1]
    return value, value2, value.tag
end

local list = { [1] = 11, tag = "first" }
local result, value2, value3 = (if true then observe else nil)()
local result2, value4, value5 = (if true then observe else nil)()
print(value2, value3, value4, value5)
print(list == result, result ~= result2, { [1] = 22, tag = "second" } == result2, list[1])
