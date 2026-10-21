local function sum(first, last, step)
    local total = 0
    for i = first, last, step do total += i end
    return total
end
print(sum(1, 7, 2), sum(7, 1, -2), sum(1, 7, -1), sum(1, 2, 0.25))
