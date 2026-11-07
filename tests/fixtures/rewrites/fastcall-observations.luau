-- Independent regression: each observed argument is evaluated exactly once.
local input = ...
local n = tonumber(input) or 4
local trace = {}
local function observe(value)
    trace[#trace + 1] = value
    return value
end
local maximum = math.max(observe(n), observe(n + 1), observe(n - 2), observe(n + 3))
local minimum = math.min(observe(n), observe(n + 1), observe(n - 2), observe(n + 3))
local combined = math.max(math.min(n, n + 1), math.min(n + 2, n + 3), math.min(n - 1, n - 2), n)
print(maximum, minimum, combined, #trace, table.concat(trace, ","))
return observe
