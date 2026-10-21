local function triangular(n)
    local total = 0
    for i = 1, n do total += i end
    return total
end
print(triangular(0), triangular(1), triangular(5), triangular(10))
