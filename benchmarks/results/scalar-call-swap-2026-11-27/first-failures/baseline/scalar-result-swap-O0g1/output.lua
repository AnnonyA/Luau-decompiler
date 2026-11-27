-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:04:46Z
-- Luau bytecode version: 14 | Luau type version: 3

local value: number = 1.75
local result, value2 = (if true then math.min else nil)(-0.5, value)
local result2 = value2
print("swap", result2, result, -result2)
local count: number = 0
while count < 2 do
    count += 1
    result2 /= 2
end
print("after", result2, result)
