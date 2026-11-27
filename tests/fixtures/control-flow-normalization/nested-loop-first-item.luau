local function firstItemTotal(values)
    local total = 0
    for _, value in values do
        local count = 0
        repeat
            count += 1
            total += value
        until count >= 2
        break
    end
    return total
end

print(firstItemTotal({7, 9}), firstItemTotal({}))
