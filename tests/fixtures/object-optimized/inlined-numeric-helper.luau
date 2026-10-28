local function weighted(value)
    return (value * 7 + 3) % 97
end
local argument = ...
local limit = tonumber(argument) or 12
local total = 0
for index = -5, limit, 2 do
    local score = weighted(index)
    total += score
    print(index, score, weighted(index + 1))
end
print('total', total)
