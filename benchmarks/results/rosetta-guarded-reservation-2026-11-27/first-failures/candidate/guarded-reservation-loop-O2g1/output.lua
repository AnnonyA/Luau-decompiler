-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:41:35Z
-- Luau bytecode version: 14 | Luau type version: 3

local function reserve(list, b, c)
    local count: number = 0
    local list2 = {}
    local map = {}
    for i = 1, #list do
        local value = list[i]
        if not map[value] then
            while true do
                if not (count >= 8) then
                    if b[count] then
                    else
                        map[value] = count + 1
                        list2[#list2 + 1] = count
                        count += 1
                        if i == #list then
                            list2[#list2 + 1] = "done"
                        end
                    end
                end
                count += 1
                if count > 7 then
                    c -= 1
                    count = 0
                    if c < 1 then
                        break
                    end
                end
            end
            return nil, "exhausted"
        end
        if i == #list then
            list2[#list2 + 1] = "done"
        end
    end
    return table.concat(list2, ",")
end

local print2 = print
local list = {}
list[0] = true
list[1] = true
print2((if true then reserve else nil)({ "a", "b", "a", "c" }, list, 2))
print((if true then reserve else nil)({ "a" }, { [0] = true, true, true, true, true, true, true, true }, 1))
