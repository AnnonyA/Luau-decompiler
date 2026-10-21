local function bits(a, b)
    return bit32.band(a, b), bit32.bor(a, b), bit32.bxor(a, b), bit32.lshift(a, 2), bit32.rshift(a, 1)
end
print(bits(5, 3))
print(bits(0, 255))
print(bits(255, 15))
