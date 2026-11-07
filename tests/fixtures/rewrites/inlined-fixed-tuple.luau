local function measure(x)
    local shifted = x * 7 + 3
    return shifted, x * x - 5, shifted > 10
end
local first = ...
local limit = tonumber(first) or 6
for i = -4, limit do
    local a, b, c = measure(i)
    print(i, a, b, c)
end
return measure
