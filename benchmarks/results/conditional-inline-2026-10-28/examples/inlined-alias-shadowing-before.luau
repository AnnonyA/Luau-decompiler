local function weighted(seed)
    return (seed + 1) * 2 + 3
end

local first = ...
local _ = tonumber
local value2 = tonumber(first) or 3
for index = -3, value2 do
    local value3 = index + 1
    print("block", value3 * 2 + 3, index + 100)
    print("loop", value3 * 2 + 3, 100)
    print("loop", value3 * 2 + 3, 101)
    local value4: number = 11
    local value5: number = 13
    local config = { value4, value5 }
    for key, value6 in config do
        print("iterator", value3 * 2 + 3, key, value6)
    end
    print("initializer", value3 * 2 + 3, 100, weighted(index))
end
print("complete", value2)
