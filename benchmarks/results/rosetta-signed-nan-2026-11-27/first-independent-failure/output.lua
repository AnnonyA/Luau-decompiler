-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:10:17Z
-- Luau bytecode version: 14 | Luau type version: 3

local list = string.format("%g|%g", (0/0), (0/0))
print(list, #list)
local value = buffer.create(16)
buffer.writef64(value, 0, (0/0))
buffer.writef64(value, 8, (0/0))
print(buffer.readu32(value, 4), buffer.readu32(value, 12))
local list2 = { (0/0), (0/0) }

local function read()
    return list2[1], list2[2]
end

print(string.format("%f|%e", (if true then read else nil)()))
print(false, false, false, false)
