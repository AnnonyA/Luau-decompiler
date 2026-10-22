local seed = tonumber(...) or 1
local function measure(scale)
    local math = {pi = 10 + scale, huge = 123}
    local samples = {3.141592653589793, 3.141592653589, 1.5707963267948966}
    local total = 0
    for _, value in ipairs(samples) do total += value * scale end
    print("shadow", math.pi, math.huge)
    return total, samples[1], samples[2], samples[3]
end
print("measure", measure(seed))
print("global", math.pi)
