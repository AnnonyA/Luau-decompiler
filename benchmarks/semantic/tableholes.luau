local function values() return 1, nil, 3, nil end
local data = table.pack(values())
print(data.n, data[1], tostring(data[2]), data[3], tostring(data[4]))
print(select("#", table.unpack(data, 1, data.n)))
