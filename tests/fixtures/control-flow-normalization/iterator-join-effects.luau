local function collect(values)
    local trace = {}
    for _, value in values do
        local pass = 0
        while pass < 2 do
            pass += 1
            if value < 0 then table.insert(trace, "negative") else table.insert(trace, "nonnegative") end
            if value % 2 == 0 then table.insert(trace, "even") else table.insert(trace, "odd") end
            if value > 5 then table.insert(trace, "large") else table.insert(trace, "small") end
            if value == 3 then table.insert(trace, "three") else table.insert(trace, "other") end
        end
    end
    return table.concat(trace, ","), #trace
end

print(collect({-1, 2, 7}))
print(collect({}))
