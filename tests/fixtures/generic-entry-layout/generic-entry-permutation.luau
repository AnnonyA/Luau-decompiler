local function collect(values)
    local total = 0
    for _, value in values do
        total += value
    end
    return total
end
local functions = {collect}
print(functions[1]({2, 3, 5}), functions[1]({}), functions[1]({7}))
