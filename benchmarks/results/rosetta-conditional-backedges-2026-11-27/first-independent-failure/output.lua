-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:18:13Z
-- Luau bytecode version: 14 | Luau type version: 3

local function visit(list, p: boolean)
    local total: number = 1
    local total2: number = 0
    local list2 = {}
    while total <= #list do
        local value = list[total]
        if p and value % 2 == 0 then
            if not (value < 50) then
                break
            end
            list2[#list2 + 1] = "even"
            total2 += value
            total += 2
        end
        if not (value < 40) then
            break
        end
        list2[#list2 + 1] = "other"
        total2 -= value
        total += 1
    end
    return total2, total, (if true then table.concat else nil)(list2, ",")
end

for _, value in { { 2, 3, 4, 5, 6 }, { 1, 4, 3, 50, 5 }, { 2, 1, 70 }, { 40 }, {} } do
    print((if true then visit else nil)(value, true))
    print((if true then visit else nil)(value, false))
end
