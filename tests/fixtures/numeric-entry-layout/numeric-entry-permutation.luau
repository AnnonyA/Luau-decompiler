local function collect(limit)
    local total = 0
    for index = 1, limit do
        total += index
    end
    return total
end
local functions = {collect}
print(functions[1](0), functions[1](1), functions[1](5))
