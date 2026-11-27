local trace = {}
for item = 3, 8 do
    trace[#trace + 1] = item
    break
end
for item = 4, 2 do
    trace[#trace + 1] = "unreachable"
    break
end
for item = 1, 1 do
    break
end
local enabled = true
while enabled do
    for item = 1, 9e9 do
        trace[#trace + 1] = "inside"
        break
    end
    break
end
local function first(limit)
    for item = 2, limit do
        return item
    end
    return -1
end
print(table.concat(trace, ","), first(5), first(0))
