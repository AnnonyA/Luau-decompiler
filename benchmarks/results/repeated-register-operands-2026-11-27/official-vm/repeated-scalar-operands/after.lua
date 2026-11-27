-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:50:11Z
-- Luau bytecode version: 14 | Luau type version: 3

local sharedCounter: number = 0

local function field()
    sharedCounter += 1
    return sharedCounter
end

local list = { field }
local value = (if true then list[1] else nil)()
local value2 = value + value
print(value2, sharedCounter)
