-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:59:29Z
-- Luau bytecode version: 14 | Luau type version: 3

local list = {}

local function emit(p, ...)
    list[#list + 1] = p
    return ...
end

local value = ("TAG"):lower()
print(value);
({ ((if true then emit else nil)("first", "start", "discard")) })["tag"] = value

local value2 = {
    [2] = { 7, "nested" },
    [3] = (if true then emit else nil)("middle", 8, "discard"),
    [4] = (if true then emit else nil)("tail", 9, nil, 11),
}

local value3 = ("LATER"):lower()
print(value3)
print(value2[1], value2.tag, type(value2[2]), value2[3], value2[4], value2[5], value2[6])
print(value2[2][1], value2[2][2], (if true then table.concat else nil)(list, ","))
value2[2][1] = 13
print(if value2 ~= value2 then false else true, value2[2][1])
