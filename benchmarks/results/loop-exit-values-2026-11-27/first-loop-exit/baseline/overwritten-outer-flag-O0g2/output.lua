-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:00:16Z
-- Luau bytecode version: 14 | Luau type version: 3

local function evaluate(limit: number)
    print("before", false)
    for index = 1, limit do
        local flag: boolean = false
        flag = not flag
    end
    return flag
end

print("zero", (if true then evaluate else nil)(0))
print("three", (if true then evaluate else nil)(3))
