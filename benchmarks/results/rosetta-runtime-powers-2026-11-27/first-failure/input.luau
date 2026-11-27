local value = tonumber("0")
value = 1.01
print(string.format("%.17g", value ^ 3))
value = -1.000100010001
print(string.format("%.17g", value ^ 3))
local function dynamic(base, exponent)
    return base ^ exponent
end
print(string.format("%.17g", dynamic(1.01, 3)))
