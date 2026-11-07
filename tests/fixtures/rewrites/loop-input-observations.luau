-- Loop setup consumes each table lookup/bound once, before iteration.
local input = ...
local seed = tonumber(input) or 2
local trace = {}
local source = setmetatable({}, {__index = function(_, key)
    trace[#trace + 1] = key
    if key == "entries" then return {seed, seed + 1} end
    if key == "first" then return 1 end
    if key == "last" then return 3 end
    return 1
end})
local total = 0
for _, value in source.entries do
    total += value
end
for index = source.first, source.last, source.step do
    total += index
end
print(total, #trace, table.concat(trace, ","))
