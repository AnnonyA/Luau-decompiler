-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:35:18Z
-- Luau bytecode version: 14 | Luau type version: 3

local function choose(a: boolean, b: boolean, c: number)
    local total: number = 0
    for i = 1, 2 do
        if not a then
            if not b then
                continue
            end
            local result
            local result2
            if c < 10 then
                result = c + i
                result2 = c - i
            else
                result = c * i
                result2 = c / i
            end
            total += result + result2
        else
            if c < 10 then
                local result3 = c + i
                local result4 = c - i
            else
                local result5 = c * i
                local result6 = c / i
            end
            total += r7 + r8
        end
    end
    return total
end

print((if true then choose else nil)(true, false, 7))
print((if true then choose else nil)(false, true, 7))
print((if true then choose else nil)(false, true, 20))
print((if true then choose else nil)(false, false, 20))
