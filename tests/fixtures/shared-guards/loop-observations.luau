-- Project-authored: a shared update precedes the iterator's existing phi.
local function collect(values)
    local reads = 0
    local trace = {}
    local stored = {}
    local cost = setmetatable({}, {__index = function(_, key)
        reads += 1
        trace[#trace + 1] = "r" .. key
        if key % 2 == 0 then return nil end
        return key + 1
    end})
    for _, value in values do
        if cost[value] == nil or value < cost[value] then
            stored[#stored + 1] = {value = value, doubled = value * 2}
            trace[#trace + 1] = "w" .. value
        end
    end
    local total = 0
    for _, item in stored do total += item.doubled end
    return #stored, reads, table.concat(trace, "/"), nil, total
end
print("loop", collect({1, 2, 3, 4}))
print("empty", collect({}))
print("repeated", collect({2, 2, 1}))
