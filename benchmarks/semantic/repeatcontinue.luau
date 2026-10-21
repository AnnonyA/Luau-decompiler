local function odds(n)
    local i = 0
    local total = 0
    repeat
        i += 1
        if i % 2 == 0 then continue end
        total += i
    until i >= n
    return total, i
end
print(odds(1))
print(odds(6))
print(odds(7))
