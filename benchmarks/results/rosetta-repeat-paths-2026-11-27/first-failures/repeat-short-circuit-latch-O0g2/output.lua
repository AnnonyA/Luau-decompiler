-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:46:34Z
-- Luau bytecode version: 14 | Luau type version: 3

local sharedCounter: number = 0
local list = {}

local function observe(delta: number)
    sharedCounter += delta
    return sharedCounter, nil, #list
end

repeat
    sharedCounter += 1
    for index = 1, 2 do
        (if true then table.insert else nil)(list, sharedCounter * 10 + index)
    end
    if sharedCounter >= 3 then
        break
    end
    if type(0 / 0) ~= "boolean" then
    end
until 0 / 0
print(sharedCounter, (if true then table.concat else nil)(list, ","))
print(select("#", (if true then observe else nil)(0)), (if true then observe else nil)(1))
return (if true then observe else nil)(2)
