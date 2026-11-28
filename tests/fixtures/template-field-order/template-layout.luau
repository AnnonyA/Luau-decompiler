-- Project-authored: template key insertion order is observable through next.
local function make(value)
    return {
        {ready = value, beta = 8},
        {abc = value, beta = 8},
        {x = value, beta = 8},
        {z = value, beta = 8},
        {epsilon = value, beta = 8},
        {alpha = value, beta = 8},
        {gamma = value, beta = 8},
        {delta = value, beta = 8},
        {one = value, beta = 8},
        {other = value, beta = 8},
        {first = value, marker = 3, last = value, tag = "tail"},
        {items = {value}, size = 1},
    }
end

local routes = {make}
local function observe(label, values)
    for index, record in values do
        local fields = {}
        for key, value in record do
            fields[#fields + 1] = key .. ":" .. type(value)
        end
        print(label, index, table.concat(fields, "|"))
    end
end
observe("number", routes[1](5))
observe("nil", routes[1](nil))
observe("false", routes[1](false))

