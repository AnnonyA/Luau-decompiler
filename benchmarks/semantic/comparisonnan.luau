local function compare(a, b)
    return a == b, a ~= b, a < b, a <= b, a > b, a >= b, not (a < b)
end
local nan = 0 / 0
print(compare(nan, 1))
print(compare(1, nan))
print(compare(1, 1))
print(compare(-1, 2))
