local n = tonumber(...) or 0
local function tail() return {n + 3}, {n + 4} end
local data = {{n}, {}, {n + 1, n + 2}, tail()}
for i, row in ipairs(data) do
    print("row", i, #row)
    for j, value in ipairs(row) do print(i, j, value) end
end
