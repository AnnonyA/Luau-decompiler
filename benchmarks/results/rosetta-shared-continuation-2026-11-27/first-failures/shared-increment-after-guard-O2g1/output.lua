-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T19:03:19Z
-- Luau bytecode version: 14 | Luau type version: 3

local function walkSteps(list, p: boolean)
    local calls: number = 1
    local count: number = 0
    local list2 = {}
    local function observe()
        return calls, nil, list2
    end

    while calls <= #list do
        local value = list[calls]
        if value < 0 then
            count += 1
        elseif value == 0 then
            count -= 1
            if count < 0 then
                return "underflow", calls, nil
            end
        else
            if value % 2 == 1 and count == 0 then
                if p then
                    return "halt", calls, nil
                end
                table.insert(list2, calls)
                calls += 1
            end
            calls += 1
            continue
        end
        calls += 1
    end
    return table.concat(list2, ","), observe()
end

print((if true then walkSteps else nil)({ 3, -1, 5, 0, 7, 2, 9 }, false))
print((if true then walkSteps else nil)({ 3, -1, 5, 0, 7, 2, 9 }, true))
print((if true then walkSteps else nil)({ 0, 3 }, false))
print(select("#", (if true then walkSteps else nil)({ 2, 4 }, false)))
