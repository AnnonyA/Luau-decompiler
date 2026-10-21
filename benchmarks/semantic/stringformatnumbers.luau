local function format(value)
    return string.format("%04d|%.2f|%+d", value, value / 3, value)
end
print(format(7))
print(format(-7))
print(format(0))
