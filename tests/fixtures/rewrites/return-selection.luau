local argument = ...
local seed = tonumber(argument) or 0
local trace = {}
local function left(...)
    table.insert(trace, "left")
    return ...
end
local function right(...)
    table.insert(trace, "right")
    return ...
end
local function choose(flag, ...)
    if flag then
        local result = left(...)
        return result
    else
        local result = right(...)
        return result
    end
end
local function choosePack(flag, ...)
    if flag then
        return left(...)
    else
        return right(...)
    end
end
local function compare(a, b)
    if a.rank ~= b.rank then
        local result = a.rank < b.rank
        return result
    else
        local result = a.id < b.id
        return result
    end
end
local values = {{rank = seed % 3, id = 3}, {rank = 1, id = 2}, {rank = seed % 3, id = 1}}
table.sort(values, compare)
for index, value in values do
    print("sorted", index, value.rank, value.id)
end
for _, flag in {true, false} do
    print("scalar", flag, select("#", choose(flag)), choose(flag), choose(flag, false, 8))
    print("pack", flag, select("#", choosePack(flag, seed, nil, 8)), choosePack(flag, seed, nil, 8))
end
print("trace", table.concat(trace, ":"))
