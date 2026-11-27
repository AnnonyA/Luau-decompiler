-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:18:56Z
-- Luau bytecode version: 14 | Luau type version: 3

local sharedCounter: number = 10
local list = {}

local function advance(p: number)
    sharedCounter += p;
    (if true then table.insert else nil)(list, tostring(sharedCounter))
    return sharedCounter, nil, sharedCounter + 100
end

local function reader()
    return sharedCounter, nil, list
end

local value = sharedCounter
local field = sharedCounter
local field2 = ((if true then advance else nil)(2))
local value2 = sharedCounter
local value3 = (if true then advance else nil)(3)
local value4 = sharedCounter
local field3 = sharedCounter
local field4 = ((if true then advance else nil)(4))
local field5 = sharedCounter
local data = { ["before"] = sharedCounter, field5, (if true then advance else nil)(5) }
local list2 = { value, field2, field }
print(list2[1], list2[2], list2[3])
local list3 = { value2, value3, value4, field4, field3 }
print(list3[1], list3[2], list3[3], list3[4], list3[5])
print(data.before, data[1], data[2], data[3], data[4])
print((if true then table.concat else nil)(list, ","), select("#", reader()), reader())
print(select("#", (if true then advance else nil)(1)), reader())
