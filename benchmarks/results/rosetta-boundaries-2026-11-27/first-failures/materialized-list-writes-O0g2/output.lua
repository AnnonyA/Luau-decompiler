-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:18:56Z
-- Luau bytecode version: 14 | Luau type version: 3

local key: string = "value"

local function read(self)
    return self.value
end;

({ [key] = 17 })["read"] = read
local object = { "alpha", "omega" }
local alias = object
print(object.value, object:read(), object[1], object[2], alias == object)
object[1] = "changed"
print(alias[1], object.read == alias.read)
