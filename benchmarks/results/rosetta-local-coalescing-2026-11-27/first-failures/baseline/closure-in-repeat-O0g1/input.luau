local result1 = 0
repeat
    result1 += 1
    local saved = (11 + 29) ^ 0
    local unused = function(...)
        return tostring(true) < "z", saved == math.clamp(0, -4, 4)
    end
until result1 >= 2
print("finished")
