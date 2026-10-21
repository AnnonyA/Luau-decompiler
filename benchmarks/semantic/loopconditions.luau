local function count(limit, enabled)
    local total = 0
    while enabled and total < limit do
        total += 1
    end
    return total
end
print(count(0, true), count(3, true), count(3, false), count(-2, true))
