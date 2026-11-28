-- Project-authored: the second lookup is conditional and remains a new read.
local function exercise(label, first, second, candidate)
    local trace = {}
    local reads = 0
    local cost = setmetatable({}, {__index = function(_, key)
        reads += 1
        trace[#trace + 1] = "read:" .. key .. ":" .. reads
        if reads == 1 then return first end
        return second
    end})
    local selected = {}
    local function choose()
        if cost.target == nil or candidate < cost.target then
            selected[#selected + 1] = {value = candidate, label = label}
            trace[#trace + 1] = "selected"
        end
    end
    local ok = pcall(choose)
    print(label, ok, reads, #selected, table.concat(trace, "/"))
end
exercise("short", nil, nil, 2)
exercise("taken", 1, 9, 2)
exercise("skip", 1, 0, 2)
exercise("error", 1, nil, 2)
exercise("nan-left", 1, 9, 0/0)
exercise("nan-right", 1, 0/0, 2)
local meta = {__lt = function(a, b)
    print("comparison", a.value, b.value)
    return a.value < b.value
end}
exercise("metamethod", setmetatable({value=1}, meta), setmetatable({value=7}, meta), setmetatable({value=3}, meta))
