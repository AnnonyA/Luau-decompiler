-- Repeated constants never assume that the global math library is unchanged.
local input = ...
local n = tonumber(input) or 4
local total = 0
for i = 1, 4 do
    total += i * 7
end
local function constants(x)
    return x + 3.141592653589793, x + 2.718281828459045
end
local a, b = constants(n)
local values = {3.141592653589793, 2.718281828459045}
print(total, a, b, values[1], values[2])
local function make()
    local seed = 0
    seed = 3.141592653589793
    return function() return seed end
end
local left, right = make(), make()
print(left == right, left(), right())
return constants
