-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:18:55Z
-- Luau bytecode version: 14 | Luau type version: 3

local function read(p)
    return p.value
end;

({ ["value"] = 17 })["read"] = read
local value = { "alpha", "omega" }
print(value.value, value:read(), value[1], value[2], value == value)
value[1] = "changed"
print(value[1], value.read == value.read)
