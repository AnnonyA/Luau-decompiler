local function tally(values)
    local total = 0
    local index = 1
    local limit = #values - 3
    while index <= limit do
        local a, b, c, d = table.unpack(values, index, index + 3)
        if not (a and b and c and d) then
            return nil, "invalid"
        end
        total += a + b * 10 + c * 100 + d * 1000
        index += 4
    end
    return total, index
end
print(tally({1, 2, 3, 4, 5, 6, 7, 8}))
print(tally({1, 2, 3, false}))
print(tally({1, 2, false, 4}))
print(tally({1, false, 3, 4}))
print(tally({false, 2, 3, 4}))
print(tally({}))
