-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:41:29Z
-- Luau bytecode version: 14 | Luau type version: 3

local sharedCounter: number = 0

local function step(list, p)
    sharedCounter += 1
    if p == nil then
        if list[1] ~= nil then
            return 1, list[1]
        end
        return nil
    end
    return nil
end

local function choose(p, p2)
    local total = p
    if -(p + p2) ~= -(p - p2) then
        total += p2
        for _, _2 in step, { 8 } do
            break
        end
    end
    return total, nil
end

local choose2 = choose
local print2 = print
local list = { choose2 }
print2((if true then list[1] else nil)(3, 2))
print(sharedCounter)
print((if true then list[1] else nil)(3, 0))
print(sharedCounter)
