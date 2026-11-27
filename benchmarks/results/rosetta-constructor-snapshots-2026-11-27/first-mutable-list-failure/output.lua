-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:04:13Z
-- Luau bytecode version: 14 | Luau type version: 3

local value: number? = tonumber("9")
value = value // 4
local list = { "start", value, false, value }
local value2 = list[2]
print(value, value2, list[4])
local total: number = 1
for index = 1, 3 do
    total += index
    local list2 = { total, index }
    print(list2[1], list2[2], total)
end

local function read()
    return value
end

value += 5
local print2 = print
local list3 = { value, read }
print2(list3[1], (if true then list3[2] else nil)(), list[2])
