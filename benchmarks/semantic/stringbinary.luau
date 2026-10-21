local value = "\255\128\0A"
print(#value, string.byte(value, 1, #value))
local other = "\254\192\175"
print(#other, string.byte(other, 1, #other))
