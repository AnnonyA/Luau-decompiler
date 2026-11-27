local function walkSteps(values, halt)
    local cursor, nesting = 1, 0
    local visited = {}
    local function observe()
        return cursor, nil, visited
    end
    while cursor <= #values do
        local token = values[cursor]
        if token < 0 then
            nesting += 1
        elseif token == 0 then
            nesting -= 1
            if nesting < 0 then
                return "underflow", cursor, nil
            end
        elseif token % 2 == 1 and nesting == 0 then
            if halt then
                return "halt", cursor, nil
            end
            table.insert(visited, cursor)
        else
            cursor += 1
            continue
        end
        cursor += 1
    end
    return table.concat(visited, ","), observe()
end
print(walkSteps({3, -1, 5, 0, 7, 2, 9}, false))
print(walkSteps({3, -1, 5, 0, 7, 2, 9}, true))
print(walkSteps({0, 3}, false))
print(select("#", walkSteps({2, 4}, false)))
