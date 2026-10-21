local function odds(n)
    local total = 0
    for i = 1, n do
        if i % 2 == 0 then continue end
        total += i
    end
    return total
end
print(odds(0), odds(1), odds(6), odds(7))
