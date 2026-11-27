-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:48:03Z
-- Luau bytecode version: 14 | Luau type version: 3

local function tally(list)
    local total: number = 0
    local total2: number = 1
    local value = #list - 3
    while total2 <= value do
        local result, value2, value3, value4 = (if true then table.unpack else nil)(list, total2, total2 + 3)
        if result and value2 and value3 then
            if not value4 then
            else
                total += result + value2 * 10 + value3 * 100 + value4 * 1000
                total2 += 4
            end
        end
        return nil, "invalid"
    end
    return total, total2
end

print((if true then tally else nil)({ 1, 2, 3, 4, 5, 6, 7, 8 }))
print((if true then tally else nil)({ 1, 2, 3, false }))
print((if true then tally else nil)({ 1, 2, false, 4 }))
print((if true then tally else nil)({ 1, false, 3, 4 }))
print((if true then tally else nil)({ false, 2, 3, 4 }))
print((if true then tally else nil)({}))
