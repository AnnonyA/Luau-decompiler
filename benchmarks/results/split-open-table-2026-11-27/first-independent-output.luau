-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:30:24Z
-- Luau bytecode version: 14 | Luau type version: 1

local sharedCounter: number = 0

local function tail(...)
    sharedCounter += 1
    return ...
end

local list = { tail }

local function build(start)
    local list2 = { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 }
    list2[17], list2[18], list2[19], list2[20], list2[21], list2[22], list2[23], list2[24], list2[25], list2[26], list2[27], list2[28], list2[29], list2[30], list2[31], list2[32] = 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32
    local value = {
        [33] = 33,
        [34] = 34,
        [35] = 35,
        [36] = 36,
        [37] = 37,
        [38] = 38,
        [39] = 39,
        [40] = 40,
        [41] = (if true then list[1] else nil)(start, nil, start + 2),
    }
    return value, value
end

local list2 = { build }
local list3, value = (if true then list2[1] else nil)(50)
print(list3 == value, #list3, list3[1], list3[40], list3[41], list3[42], list3[43], sharedCounter)
