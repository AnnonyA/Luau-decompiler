-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:17:30Z
-- Luau bytecode version: 14 | Luau type version: 3

local sharedCounter: number = 1

local function bump()
    sharedCounter += 10
    return sharedCounter
end

local max = math.max
print(sharedCounter, (if true then bump else nil)(), sharedCounter)
print((if true then math.max else nil)(sharedCounter, (if true then bump else nil)()), sharedCounter)
print((if true then max else nil)(sharedCounter, (if true then bump else nil)()), sharedCounter)
local print2 = print
local value = sharedCounter
local value2 = (if true then bump else nil)()
local value3 = sharedCounter
local tbl = {}

function tbl.show(p, ...)
    return select("#", ...), ...
end

print2(tbl:show(value, value2, value3))
print(tostring(sharedCounter) .. tostring((if true then bump else nil)()), sharedCounter)
local field = sharedCounter
local field2 = sharedCounter
local list = { field, ((if true then bump else nil)()), field2 }
print(list[1], list[2], list[3])
print(sharedCounter + (if true then bump else nil)(), sharedCounter)
print(select(2, sharedCounter, (if true then bump else nil)(), sharedCounter))
