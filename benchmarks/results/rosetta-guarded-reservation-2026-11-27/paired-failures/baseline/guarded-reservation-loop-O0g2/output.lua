-- [[ annonya.github.io ]] v0.2.0 | decompiled at 2026-11-27T18:45:45Z
-- Luau bytecode version: 14 | Luau type version: 3

local function reserve(items, taken, attempts)
    local count: number = 0
    local list = {}
    local map = {}
    for index = 1, #items do
        local item = items[index]
        if not map[item] then
            while true do
                if not (count >= 8) then
                    if taken[count] then
                    else
                        map[item] = count + 1
                        list[#list + 1] = count
                        count += 1
                        if index == #items then
                            list[#list + 1] = "done"
                        end
                    end
                end
                count += 1
                if count > 7 then
                    attempts -= 1
                    count = 0
                    if attempts < 1 then
                        break
                    end
                end
            end
            return nil, "exhausted"
        end
        if index == #items then
            list[#list + 1] = "done"
        end
    end
    return (if true then table.concat else nil)(list, ",")
end

local print2 = print
local list = { [0] = true }
list[1] = true
print2((if true then reserve else nil)({ "a", "b", "a", "c" }, list, 2))
print((if true then reserve else nil)({ "a" }, { [0] = true, true, true, true, true, true, true, true }, 1))
