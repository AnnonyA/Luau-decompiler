-- Both the builtin fast path and a replacement environment must call once.
local input = ...
local seed = tonumber(input) or 3
local trace = {}
local function pack(value)
    trace[#trace + 1] = "pack"
    return value, value + 1, value + 2
end
local function compute(value)
    local maximum, extra = math.max(pack(value))
    local minimum = math.min(value, value - 1)
    return maximum, extra, minimum
end
print("native", compute(seed))
local replacement = {
    max = function(...)
        trace[#trace + 1] = "max:" .. select("#", ...)
        local a, b, c = ...
        return a + b + c, "second"
    end,
    min = function(a, b)
        trace[#trace + 1] = "min"
        return a - b
    end,
}
setfenv(compute, setmetatable({math = replacement}, {__index = getfenv()}))
print("fallback", compute(seed))
print(table.concat(trace, ","))
