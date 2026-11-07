local argument = ...
local seed = tonumber(argument) or 0
local function observe(fn, value)
    print("name", debug.info(fn, "n"), fn(), value[1])
end
local function getItems()
    local result = {}
    result[1] = seed
    local function items()
        return seed + 1
    end
    local function items2()
        return seed + 2
    end
    observe(items, result)
    observe(items2, result)
    return result
end
local values = getItems()
print("result", values[1])
