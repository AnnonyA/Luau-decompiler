local count = tonumber((...)) or 2
local value = math.sqrt(-count)
local functions = {}
for i = 1, count do
    functions[i] = function() return value end
end
local keys = {[functions[1]] = "first"}
print(functions[1] == functions[2], value == value, keys[functions[2]])
