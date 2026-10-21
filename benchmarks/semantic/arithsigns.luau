local function compute(a, b)
    return a + b, a - b, a * b, -a
end
print(compute(7, 3))
print(compute(-7, 3))
print(compute(0, -4))
