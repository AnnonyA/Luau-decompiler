local function record(value, index)
    if index < 0 then
        value.low = index * 3 - 1
        value.tag = -1
        return
    else
        value.high = index * 7 + 2
        value.tag = 1
    end
end

local first = ...
local _ = tonumber
local value2 = tonumber(first) or 3
local config = { low = 0, high = 0, tag = 0 }
for i = -3, value2 do
    print("before", i, config.tag)
    if i < 0 then
        config.low = i * 3 - 1
        config.tag = -1
    else
        config.high = i * 7 + 2
        config.tag = 1
    end
    print("after", i, config.low, config.high, config.tag)
end
print("final", config.low, config.high, config.tag)
