local seed = tonumber(...) or 1
local rows = {}
local getters = {}
for i = 1, 3 do
    local row = {}
    for j = 1, 3 do row[j] = seed + i * 10 + j end
    rows[i] = row
    local diagonal = row[i]
    getters[i] = function(offset) return diagonal + offset, row[i] end
end
for i = 1, 3 do rows[i][i] += i end
local sum = 0
for i, row in ipairs(rows) do
    for j, value in ipairs(row) do
        if i ~= j then sum += value end
    end
    print("capture", i, getters[i](seed))
end
print("matrix", sum)
