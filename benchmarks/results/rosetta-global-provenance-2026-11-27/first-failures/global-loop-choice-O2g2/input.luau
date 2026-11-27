local trace = {}
local alias = trace
local function choose(values)
    for position, value in ipairs(values) do
        if value > 6 then
            index = position
            table.insert(trace, "stored:" .. tostring(index))
            break
        end
    end
    return index
end
local function readChoice()
    return index, nil, trace
end
local function localShadow(index)
    index += 1
    return index
end
print(choose({3, 9, 8}), index)
print(select("#", readChoice()), readChoice())
print(choose({8}), localShadow(40), readChoice())
print(trace == alias, table.concat(alias, "|"))
return index, nil, alias
