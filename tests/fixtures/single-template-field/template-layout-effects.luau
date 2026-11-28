local trace = {}
local proxy = setmetatable({}, {
    __index = function(_, key)
        table.insert(trace, "read:" .. key)
        return 3
    end,
})
local function create(value)
    return { ready = proxy.value == value }
end
local first, second = create(3), create(4)
print(table.concat(trace, "|"), first.ready, second.ready, first == second)
local function keys(record)
    local values = {}
    for key in record do
        table.insert(values, key)
    end
    return table.concat(values, ",")
end
print(keys(first), keys(second), #first, #second)
first.alpha = 1
first.beta = 2
first.gamma = 3
first.ready = nil
first.delta = 4
first.ready = false
print(keys(first), #first, first.ready, first.alpha)
first.beta = nil
first.epsilon = 5
print(keys(first), first.gamma, first.delta, first.epsilon)
local alias = first
alias.ready = 9
print(first == alias, first.ready, second.ready)
