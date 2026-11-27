-- Project-authored observations: captures, effects, branches and result packs.
local function observe(limit)
    local trace = {}
    local value = 1
    local function change()
        value += 3
        table.insert(trace, value)
        return value, nil, value + 1
    end
    local a, b, c = change()
    if value == 1 then error("stale captured fact") end
    local saved = {}
    for i = 1, limit do
        local snapshot = i
        saved[i] = function() return snapshot, value end
        if i % 2 == 0 then table.insert(trace, -i) end
    end
    local steps = 0
    repeat
        steps += 1
        value += steps
    until steps >= limit
    for i, get in saved do
        local x, y = get()
        table.insert(trace, x + y)
    end
    local x = 0/0
    print(a, b, c, value, x == x, not (x <= x), table.concat(trace, ","))
    return change()
end
print(observe(4))
