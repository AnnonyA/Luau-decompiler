-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:45:54Z
-- Luau bytecode version: 14 | Luau type version: 3

local function values(...)
    return ...
end

local field = (values(5, 6))
local value = (if true then math.max else nil)(17.25, 0.75)
local value2 = (if true then math.ceil else nil)(-3)
local clamp = math.clamp
local list = { 4, "child" }
local field2 = -3
local field3 = ((if true then clamp else nil)(7, -4, 4))
local value3 = ("prefix"):sub(1, 2)
local value4 = (if true then math.clamp else nil)(19, -4, 4)
local field4 = -2
local field5 = ((if true then math.max else nil)(17, 9))
local field6 = (values(5, 6))
local sin = math.sin
local list2 = { field4, "tail" }
local value5 = (if true then sin else nil)(1 / 10)
local value6 = (if true then math.sin else nil)(2 / 10)
local value7 = (if true then math.sin else nil)(3 / 10)
local value8 = (if true then math.sin else nil)(4 / 10)
local value9 = (if true then math.sin else nil)(5 / 10)
local value10 = (if true then math.sin else nil)(6 / 10)
local value11 = (if true then math.sin else nil)(7 / 10)
local value12 = (if true then math.sin else nil)(8 / 10)
local list3 = { value3, value4, 19, [1] = field5, field6 }
local list4 = { value2, field2, field3, 1, [""] = "marker" }
local list5 = { value, values(5, 6) }
local result = if math.pi > 2 then 19 else 23
print(result, value5, value6, value7, value8, value9, value10, value11, value12)
print(type(list4[2]), type(list3[3]), list4[1], list3[1], list4[""], #{ 13, 17.25, field }, #list5)
print(list4[2][1], list4[2][2], list3[3][1], list3[3][2])
local value13 = list4[2]
local value14: number = 1
value13[value14] = value13[value14] + 7
print(list4[2][1], list3[3][1])
