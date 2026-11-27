-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:08:26Z
-- Luau bytecode version: 14 | Luau type version: 3

local function carry(outer, inner)
    return outer(inner())
end

local carry2 = carry
local list = {}

local function values(): (number, nil, number, nil, number)
    list[#list + 1] = "produce"
    return 1, nil, 3, nil, 5
end

local function observe(...)
    list[#list + 1] = "consume"
    print(select("#", ...), ...)
    return ...
end

local pack = table.pack
local list2 = { carry2 }
local packed = (if true then pack else nil)((if true then list2[1] else nil)(observe, values))
print(packed.n, packed[1], packed[2], packed[3], packed[4], packed[5])
print((if true then table.concat else nil)(list, ","))
