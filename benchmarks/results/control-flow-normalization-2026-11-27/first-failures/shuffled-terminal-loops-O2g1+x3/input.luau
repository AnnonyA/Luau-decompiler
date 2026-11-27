local function scenario(limit)
    local trace = {}
    for index = 1, limit do
        table.insert(trace, "first" .. index)
        if index == 2 then
            break
        end
    end
    for index = 1, limit do
        table.insert(trace, "single" .. index)
        break
    end
    local count = 0
    while count < 3 do
        count += 1
        table.insert(trace, "after" .. count)
    end
    return table.concat(trace, ",")
end

print(scenario(3))
print(scenario(0))
