local function weighted(value)
    return (value * 7 + 3) % 97
end
local function measure(value)
    return value * 3 + 2, value * 5 - 1
end
local function consume(limit)
    local total = 0
    for index = -3, limit do
        local left, right = measure(index)
        print("tuple", left, right)
        total += weighted(index) + left - right
        print("step", index, total)
    end
    return total, weighted, measure
end
local callback = function(limit)
    local total = 0
    for index = 1, limit do
        total += weighted(index)
    end
    return total, weighted
end
local function factory()
    return function(limit)
        local total = 0
        for index = 1, limit do
            total += weighted(index)
        end
        return total, weighted
    end
end
local argument = ...
local limit = tonumber(argument) or 4
local consumers = {consume, callback, factory(), factory()}
for index, fn in consumers do
    local total, identity, tuple = fn(limit)
    print("result", index, total, identity == weighted, tuple == measure)
end
print("closures", consumers[3] == consumers[4])
