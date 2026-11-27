-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:26:33Z
-- Luau bytecode version: 14 | Luau type version: 3

local function clipped(values, lower: number, upper: number)
    local list = {}
    for index = lower and 1, #values < upper and #values or upper do
        local value = #list + 1
        list[value] = values[index]
    end
    return table.concat(list, ",")
end

local print2 = print
local list = { "a", "b", "c", "d" }
print2((if true then clipped else nil)(list, 2, 3))
print((if true then clipped else nil)(list, -1, 3))
print((if true then clipped else nil)(list, 3, 99))

local function selected(value: boolean | nil | number): boolean | nil | number | string
    return if value == nil then "missing" else value
end

print((if true then selected else nil)(nil), (if true then selected else nil)(false), (if true then selected else nil)(0), (if true then selected else nil)(7))
