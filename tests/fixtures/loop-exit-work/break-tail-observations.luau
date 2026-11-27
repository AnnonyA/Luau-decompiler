local function choose(limit)
    local result
    local trace = {}
    for position = 1, limit do
        trace[#trace + 1] = position
        if position % 3 == 0 and position > 4 then
            result = position
            break
        end
    end
    local saved = result
    return result, function() return saved end, table.concat(trace, ","), nil
end
local function inspect(limit)
    local packed = table.pack(choose(limit))
    print(limit, packed.n, packed[1], packed[2](), packed[3], packed[4])
end
inspect(0)
inspect(3)
inspect(9)
inspect(12)
