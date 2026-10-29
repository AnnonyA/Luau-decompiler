local function record(config2, index)
    if index < 0 then
        config2.low = index * 3 - 1
        config2.tag = -1
        return
    else
        config2.high = index * 7 + 2
        config2.tag = 1
    end
end

local first = ...
local _ = tonumber
local value2 = tonumber(first) or 3
local config = { low = 0, high = 0, tag = 0 }
for i = -3, value2 do
    print("before", i, config.tag)
    record(config, i)
    print("after", i, config.low, config.high, config.tag)
end
print("final", config.low, config.high, config.tag)
