-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:00:16Z
-- Luau bytecode version: 14 | Luau type version: 3

local function evaluate(limit: number)
    local flag: boolean = false
    local list = {}
    for index = 1, limit do
        local latest: boolean = false
        local snapshot = latest
        list[index] = function()
            return snapshot, index
        end

        latest = not latest
    end
    return latest, list
end

local zero, empty = (if true then evaluate else nil)(0)
local latest, snapshots = (if true then evaluate else nil)(3)
print(zero, #empty, latest, #snapshots)
for _, snapshot2 in snapshots do
    print(snapshot2())
end
