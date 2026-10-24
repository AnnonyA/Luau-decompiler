local function rotate(values, delta)
    local first = table.remove(values, 1)
    values[#values + 1] = first + delta
    print(#values, values[1], values[2], values[3], values[4])
end
rotate({4, 7, 9}, 2)
rotate({1, 2, 3}, -1)
