local function weighted(seed)
    return (seed + 1) * 2 + 3
end

local first = ...
local _ = tonumber
local value2 = tonumber(first) or 3
for index = -3, value2 do
    local value3 = index + 1
    print("block", weighted(index), index + 100)
    print("loop", weighted(index), 100)
    print("loop", weighted(index), 101)
    local value4: number = 11
    local value5: number = 13
    local config = { value4, value5 }
    for key, value6 in config do
        print("iterator", weighted(index), key, value6)
    end
    print("initializer", weighted(index), 100, weighted(index))
end
print("complete", value2)
