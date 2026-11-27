-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:21:19Z
-- Luau bytecode version: 14 | Luau type version: 3

local function locate(p, p2: number)
    local calls: number = 0
    local flag: boolean = false
    repeat
        calls += 1
        if p[calls] ~= p2 then
            continue
        end
        flag = true
        break
    until p[calls] <= calls
    return flag, calls
end

print((if true then locate else nil)({ 4, 9, 16, 25 }, 9))
print((if true then locate else nil)({ 4, 9, 16, 25 }, 30))
