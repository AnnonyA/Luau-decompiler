print("begin")
local total, closures = 0, {}
for index, value in ipairs({2, 3, 5}) do
    total += value
    closures[index] = function() return index, value end
end
print("sum", total, #closures)
for _, closure in closures do print("capture", closure()) end
local empty = 0
for _, value in {} do empty += value end
print("empty", empty)
local nested = 0
for _, values in {{7, 11}, {13}} do
    for _, value in values do nested += value end
end
print("nested", nested)
print("end")
