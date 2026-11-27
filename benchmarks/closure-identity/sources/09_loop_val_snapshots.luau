local count = tonumber((...)) or 2
local functions = {}
for i = 1, count do
    functions[i] = function() return i end
end
local keys = {[functions[1]] = "first"}
print(functions[1] == functions[2], functions[1](), functions[2](), keys[functions[2]])
