local function weighted(seed)
    return (seed * 7 + 3) % 97
end

local first = ...
local _ = tonumber
local value2 = tonumber(first) or 12
local result: number = 0
for index = -5, value2, 2 do
    local value3 = weighted(index)
    result += value3
    print(index, value3, weighted(index + 1))
end
print("total", result)
