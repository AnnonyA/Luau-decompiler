-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:02:11Z
-- Luau bytecode version: 14 | Luau type version: 3

local result = tonumber("8") + 0.25
local list = {}
local snapshot
for index = 1, 3 do
    local captured = result
    list[index] = function()
        return captured
    end

    snapshot = result
    result = index
end
print(result, result, (if true then list[1] else nil)(), (if true then list[2] else nil)(), (if true then list[3] else nil)())
