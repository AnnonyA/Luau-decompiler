local current = tonumber("8") + 0.25
local original = current
local captures = {}
for iteration = 1, 3 do
    local value = original
    captures[iteration] = function() return value end
    current = iteration
end
print(original, current, captures[1](), captures[2](), captures[3]())
