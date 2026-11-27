-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:51:45Z
-- Luau bytecode version: 14 | Luau type version: 3

local _: number? = tonumber("0")
print(string.format("%.17g", 1.01 ^ 3))
print(string.format("%.17g", (-1.000100010001) ^ 3))

local function dynamic(p: number, p2: number)
    return p ^ p2
end

print(string.format("%.17g", dynamic(1.01, 3)))
