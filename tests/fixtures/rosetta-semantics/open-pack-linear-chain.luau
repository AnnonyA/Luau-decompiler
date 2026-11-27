local trace = {}
local function carry(outer, inner)
    return outer(inner())
end
local callbacks = {carry}
local function values()
    trace[#trace + 1] = "produce"
    return 1, nil, 3, nil, 5
end
local function observe(...)
    trace[#trace + 1] = "consume"
    print(select("#", ...), ...)
    return ...
end
local packed = table.pack(callbacks[1](observe, values))
print(packed.n, packed[1], packed[2], packed[3], packed[4], packed[5])
print(table.concat(trace, ","))
