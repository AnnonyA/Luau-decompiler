local function sum(values)
    local total = 0
    local count = 0
    for key, value in pairs(values) do
        total += value
        count += 1
    end
    return total, count
end
print(sum({}))
print(sum({a = 3, b = -1, c = 8}))
print(sum({[7] = 5, name = 2}))
