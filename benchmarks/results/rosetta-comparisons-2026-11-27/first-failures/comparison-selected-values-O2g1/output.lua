-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:26:32Z
-- Luau bytecode version: 14 | Luau type version: 3

local function clipped(list, b: number, c: number)
    local list2 = {}
    for i = b and 1, #list < c and #list or c do
        list2[#list2 + 1] = list[i]
    end
    return table.concat(list2, ",")
end

local print2 = print
local list = { "a", "b", "c", "d" }
print2((if true then clipped else nil)(list, 2, 3))
print((if true then clipped else nil)(list, -1, 3))
print((if true then clipped else nil)(list, 3, 99))

local function selected(p)
    return if p == nil then "missing" else p
end

print("missing", false, 0, 7)
