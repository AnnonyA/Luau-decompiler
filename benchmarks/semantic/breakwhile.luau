local function search(limit, stop)
    local n = 0
    while n < limit do
        n += 1
        if n == stop then break end
    end
    return n
end
print(search(0, 1), search(5, 3), search(5, 9), search(5, 1))
