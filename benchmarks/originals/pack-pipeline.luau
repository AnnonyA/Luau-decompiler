local seed = tonumber(...) or 1
local trace = {}
local function mark(label, ...)
    trace[#trace + 1] = label
    return ...
end
local function relay(callback, ...)
    local count = select("#", ...)
    return count, callback(...)
end
local function transform(first, ...)
    return first * 2, nil, select("#", ...), ...
end
local function show(...)
    local n = select("#", ...)
    for i = 1, n do print("slot", i, select(i, ...)) end
end
show(relay(transform, mark("input", seed, nil, false, "tail")))
local fixed = {mark("a", seed, 100), (mark("b", 7, 8))}
local open = {seed, mark("c", 9, nil, 11)}
print("tables", #fixed, fixed[1], fixed[2], open[2], open[3], open[4])
print("trace", table.concat(trace, ","))
