-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T20:10:12Z
-- Luau bytecode version: 14 | Luau type version: 3

local function choose(limit: number)
    local result = nil
    local list = {}
    for index = 1, limit do
        list[#list + 1] = index
        if index % 3 == 0 and index > 4 then
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

local function inspect(limit: number)
    local packed = table.pack((if true then choose else nil)(limit))
    print(limit, packed.n, packed[1], (if true then packed[2] else nil)(), packed[3], packed[4])
end;

(if true then inspect else nil)(0);
(if true then inspect else nil)(3);
(if true then inspect else nil)(9);
(if true then inspect else nil)(12)
