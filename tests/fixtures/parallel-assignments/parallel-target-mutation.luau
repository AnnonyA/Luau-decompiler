local trace, first, second = {}, {}, {}
local active, key = first, 1
local proxy = setmetatable({}, {
    __newindex = function(_, slot, value)
        table.insert(trace, "proxy:" .. slot .. ":" .. value)
        key = 2
        active = second
    end,
})
local function value(label)
    table.insert(trace, "value:" .. label)
    return label
end
local function sequential()
    local a = value("A")
    local b = value("B")
    proxy[key] = a
    active[key] = b
end
sequential()
print(table.concat(trace, "|"), first[1], first[2], second[1], second[2])
table.clear(trace)
active, key = first, 1
local function mutate()
    table.insert(trace, "mutate")
    active, key = second, 2
    return "C", "extra"
end
active[key], proxy[key] = mutate(), value("D")
print(table.concat(trace, "|"), first[1], first[2], second[1], second[2])

table.clear(trace)
active, key = first, 1
local function target()
    table.insert(trace, "target")
    return active
end
local function nextKey()
    table.insert(trace, "next-key")
    return key
end
local a, b = value("E"), value("F")
proxy[key] = a
target()[nextKey()] = b
print(table.concat(trace, "|"), first[1], second[2])
