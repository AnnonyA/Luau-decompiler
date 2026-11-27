-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:12:40Z
-- Luau bytecode version: 14 | Luau type version: 3

_ = "environment"
local sharedCounter: number = 0

local function observe()
    sharedCounter += 1
    return sharedCounter, nil, _
end

print(_, sharedCounter)
print(select("#", (if true then observe else nil)()), (if true then observe else nil)())
