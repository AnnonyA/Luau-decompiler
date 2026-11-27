local function choose(first, second, value)
    local total = 0
    for index = 1, 2 do
        if first or second then
            local left, right
            if value < 10 then
                left = value + index
                right = value - index
            else
                left = value * index
                right = value / index
            end
            total += left + right
        end
    end
    return total
end
print(choose(true, false, 7))
print(choose(false, true, 7))
print(choose(false, true, 20))
print(choose(false, false, 20))
