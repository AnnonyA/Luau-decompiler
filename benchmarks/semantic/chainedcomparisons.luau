local function within(x, low, high)
    return x >= low and x <= high, x < low or x > high
end
print(within(-2, -1, 1))
print(within(-1, -1, 1))
print(within(0, -1, 1))
print(within(1, -1, 1))
print(within(2, -1, 1))
