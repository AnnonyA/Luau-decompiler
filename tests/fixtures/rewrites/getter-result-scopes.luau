local argument = ...
local seed = tonumber(argument) or 0
local function getItems(limit)
    local result = {}
    local readers = {}
    for index = 1, math.abs(limit) + 2 do
        result[index] = index + limit
        readers[index] = function(items)
            return result[index], items
        end
    end
    if limit < 0 then
        for index, reader in readers do
            print("negative", index, reader(limit))
        end
        return result
    end
    for index, reader in readers do
        print("positive", index, reader(limit))
    end
    return result
end
local outer = {}
local function getForeign()
    return outer
end
local function getPrint()
    local result = {}
    result[1] = seed
    local function observe(print2)
        print("captured", result[1], print2)
        return result
    end
    observe(seed + 1)
    return result
end
local function getPair()
    local result = {}
    result[1] = seed * 2
    return result, nil, 9
end
local values = getItems(seed)
for index, value in values do
    print("item", index, value)
end
print("identity", getForeign() == outer, getPrint()[1], select("#", getPair()))
local pair, empty, last = getPair()
print("pair", pair[1], empty, last)
