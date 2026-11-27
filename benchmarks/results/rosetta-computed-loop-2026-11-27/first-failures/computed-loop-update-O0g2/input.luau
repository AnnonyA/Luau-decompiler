local function reverseBits(value, width)
    local reverse = 0
    for index = 1, width do
        reverse = reverse - reverse % 2 + ((reverse % 2 == 1 or value % 2 == 1) and 1 or 0)
        value = (value - value % 2) / 2
        reverse = reverse * 2
    end
    return (reverse - reverse % 2) / 2
end
print(reverseBits(13, 5))
print(reverseBits(27, 10))
print(reverseBits(0, 3))
