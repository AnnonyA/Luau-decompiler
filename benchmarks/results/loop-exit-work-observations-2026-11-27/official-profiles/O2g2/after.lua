-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T20:12:06Z
-- Luau bytecode version: 14 | Luau type version: 3

local function choose(limit)
    local result = nil
    local list = {}
    for index = 1, limit do
        list[#list + 1] = index
        if index % 3 == 0 and index > 4 then
            result = index
            break
        end
    end
    local function_
    do
        local captured
        captured = result
        function_ = function()
            return captured
        end

    end
    return result, function_, table.concat(list, ","), nil
end

local function inspect(limit)
    local packed = table.pack((if true then choose else nil)(limit))
    print(limit, packed.n, packed[1], (if true then packed[2] else nil)(), packed[3], packed[4])
end

local packed = table.pack((if true then choose else nil)(0))
print(0, packed.n, packed[1], (if true then packed[2] else nil)(), packed[3], packed[4])
local packed2 = table.pack((if true then choose else nil)(3))
print(3, packed2.n, packed2[1], (if true then packed2[2] else nil)(), packed2[3], packed2[4])
local packed3 = table.pack((if true then choose else nil)(9))
print(9, packed3.n, packed3[1], (if true then packed3[2] else nil)(), packed3[3], packed3[4])
local packed4 = table.pack((if true then choose else nil)(12))
print(12, packed4.n, packed4[1], (if true then packed4[2] else nil)(), packed4[3], packed4[4])
