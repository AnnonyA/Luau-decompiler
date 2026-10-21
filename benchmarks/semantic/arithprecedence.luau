local function compute(a, b, c)
    return (a + b) * c, a + b * c, a - (b - c), (a ^ b) ^ c, a ^ (b ^ c)
end
print(compute(2, 3, 2))
print(compute(-1, 2, 3))
