-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:54:25Z
-- Luau bytecode version: 14 | Luau type version: 3

local function exercise()
    local function function_(): number
        print("before arithmetic")
        return 37
    end

    print(-missingOperand ^ 3, (-missingOperand) ^ 3)
    print(not missingOperand == secondOperand)
end

local success, result = pcall(exercise)
print(success, tostring(result):match("arithmetic %((%w+)%)"))
