local function weighted(value)
    return if value * 1 < 0 then value * 3 - 1 else value * 7 + 2
end
local trace = {}
local function box(value)
    return setmetatable({value = value}, {
        __mul = function(left, right)
            trace[#trace + 1] = "multiply"
            return left.value * right
        end,
    })
end
local first = ...
local seed = tonumber(first) or -2
local calls = 0
local function pull(value)
    calls += 1
    trace[#trace + 1] = "pull"
    return box(value), "tail", calls
end
local result = weighted(pull(seed))
print("boxed", result, calls, table.concat(trace, ","))
local function pair(value)
    return weighted(value), "tail", value + 1
end
local function observe(...)
    print("arity", select("#", ...), ...)
end
observe(pair(seed))
for index = -3, 3 do
    observe(weighted(index))
end
