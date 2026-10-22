local seed = tonumber(...) or 1
local events = {}
local box = {value = seed}
local function tick(label, delta)
    events[#events + 1] = label
    box.value += delta
    return box.value
end
local function sink(a, b, c) print("sink", a, b, c, box.value) end
sink(tick("a", 1), box.value, tick("b", 2))
local before = box.value
local thunk = function() return before, box.value end
local values = {[tick("key", 1)] = tick("value", 2), last = tick("last", 3)}
print("values", values[seed + 4], values.last)
print("thunk", thunk())
print("events", table.concat(events, ","))
