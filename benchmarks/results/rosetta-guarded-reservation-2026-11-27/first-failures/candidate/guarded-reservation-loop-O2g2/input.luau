local function reserve(items, taken, attempts)
    local reserved = {}
    local trace = {}
    local position = 0
    for index = 1, #items do
        local item = items[index]
        if not reserved[item] then
            while position >= 8 or taken[position] do
                position += 1
                if position > 7 then
                    attempts -= 1
                    position = 0
                    if attempts < 1 then
                        return nil, "exhausted"
                    end
                end
            end
            reserved[item] = position + 1
            trace[#trace + 1] = position
            position += 1
        end
        if index == #items then
            trace[#trace + 1] = "done"
        end
    end
    return table.concat(trace, ",")
end
print(reserve({"a", "b", "a", "c"}, {[0] = true, [1] = true}, 2))
print(reserve({"a"}, {[0]=true, true, true, true, true, true, true, true}, 1))
