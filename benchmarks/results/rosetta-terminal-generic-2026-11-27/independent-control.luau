local events = {}
local function nextValue(state, previous)
    table.insert(events, previous == nil and "first" or "next")
    if #state == 0 then return nil end
    return (previous or 0) + 1, state[1]
end

local function visit(values)
    for key, value in nextValue, values do
        break
    end
    local result = {count = #events}
    result.present = #values > 0
    return function(delta)
        result.count += delta
        return result.count, result.present, nil
    end, #events
end

local first, firstCount = visit({7})
local empty, emptyCount = visit({})
print(firstCount, emptyCount, table.concat(events, ","))
print(first(2))
print(empty(0))
print(first(1))

local iterable = setmetatable({}, {__iter = function()
    table.insert(events, "prepare")
    return nextValue, {9}, nil
end})
for key, value in iterable do break end
print(table.concat(events, ","))
