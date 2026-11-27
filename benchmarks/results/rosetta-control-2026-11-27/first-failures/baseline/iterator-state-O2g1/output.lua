-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:21:18Z
-- Luau bytecode version: 14 | Luau type version: 3

local total: number = 0
local list = { 11, 22, 33 }
for key, value in next do
    total += key * value
end
print(total)
for key2, value2 in next, list, 1 do
    print("after", key2, value2)
end
for key3, value3 in ipairs(list) do
    print("array", key3, value3)
end

local function triple(p)
    return next, p, nil
end

for key4, value4 in next, list do
    print("triple", key4, value4)
end
