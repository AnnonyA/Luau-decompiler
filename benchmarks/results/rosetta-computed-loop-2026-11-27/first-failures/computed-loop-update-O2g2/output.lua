-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:40:13Z
-- Luau bytecode version: 14 | Luau type version: 3

local function reverseBits(value, width: number)
    local result: number = 0
    local result2
    for index = 1, width do
        local value2 = result - result % 2
        result2 = if result % 2 ~= 1 then if value % 2 == 1 then 1 else 0 else 1
        local reverse = value2 + result2
        value = (value - value % 2) / 2
        reverse *= 2
    end
    return (reverse - reverse % 2) / 2
end

print(((if true then reverseBits else nil)(13, 5)))
print(((if true then reverseBits else nil)(27, 10)))
print(((if true then reverseBits else nil)(0, 3)))
