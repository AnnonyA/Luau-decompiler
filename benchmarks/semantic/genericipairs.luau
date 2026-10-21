local function fold(values)
    local total = 0
    for index, value in ipairs(values) do total += index * value end
    return total
end
print(fold({}), fold({4}), fold({2, 3, 4}), fold({2, nil, 4}))
