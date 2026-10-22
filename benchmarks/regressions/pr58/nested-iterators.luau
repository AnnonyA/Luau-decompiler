local n = tonumber(...) or 0
local total = 0
for i, row in ipairs({{1, 2}, {}, {3, 4, 5}}) do
    print("before", i)
    for j, value in ipairs(row) do total += value + j + n end
    total += i * 10
    print("after", i, total)
end
print("done", total)
