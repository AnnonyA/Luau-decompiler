local values = {11, 22, 33}
local sum = 0
for key, value in next, values do sum += key * value end
print(sum)
for key, value in next, values, 1 do print("after", key, value) end
for key, value in ipairs(values) do print("array", key, value) end
local function triple(t)
    return next, t, nil
end
for key, value in triple(values) do print("triple", key, value) end
