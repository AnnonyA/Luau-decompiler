-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:35:18Z
-- Luau bytecode version: 14 | Luau type version: 3

local function choose(first: boolean, second: boolean, value: number)
    local total: number = 0
    for index = 1, 2 do
        if not first then
            if not second then
                continue
            end
            local left
            local right
            if value < 10 then
                left = value + index
                right = value - index
            else
                left = value * index
                right = value / index
            end
            total += left + right
        else
            if value < 10 then
                local left2 = value + index
                local right2 = value - index
            else
                local left3 = value * index
                local right3 = value / index
            end
            total += left + right
        end
    end
    return total
end

print((if true then choose else nil)(true, false, 7))
print((if true then choose else nil)(false, true, 7))
print((if true then choose else nil)(false, true, 20))
print((if true then choose else nil)(false, false, 20))
