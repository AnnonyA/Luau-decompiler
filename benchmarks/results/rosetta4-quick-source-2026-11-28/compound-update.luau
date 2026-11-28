local initial = tonumber("25")
local total = initial
for i = 1, 3 do
    total //= (i + 1)
    total ^= 2
    print(total)
end
return total
