local function clipped(values, lower, upper)
    local items = {}
    for index = lower < 1 and 1 or lower, upper > #values and #values or upper do
        items[#items + 1] = values[index]
    end
    return table.concat(items, ",")
end

local values = {"a", "b", "c", "d"}
print(clipped(values, 2, 3))
print(clipped(values, -1, 3))
print(clipped(values, 3, 99))

local function selected(value)
    return value == nil and "missing" or value
end

print(selected(nil), selected(false), selected(0), selected(7))
