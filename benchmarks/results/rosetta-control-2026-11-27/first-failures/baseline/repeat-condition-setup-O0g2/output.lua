-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:21:20Z
-- Luau bytecode version: 14 | Luau type version: 3

local function locate(values, wanted: number)
    local calls: number = 0
    local flag: boolean = false
    repeat
        calls += 1
        if values[calls] ~= wanted then
            continue
        end
        flag = true
        break
    until values[calls] <= calls
    return flag, calls
end

print((if true then locate else nil)({ 4, 9, 16, 25 }, 9))
print((if true then locate else nil)({ 4, 9, 16, 25 }, 30))
