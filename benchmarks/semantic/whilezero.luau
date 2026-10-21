local function reduce(n)
    local total = 0
    while n > 0 do
        total += n
        n -= 2
    end
    return total, n
end
print(reduce(0))
print(reduce(5))
print(reduce(6))
