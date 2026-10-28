local function blend(value, index)
    return (value * value + index * 3) / (value - index)
end

local first = ...
local _ = tonumber
local _2 = tonumber(first) or 5
for i = -3, tonumber(first) or 5 do
    local value2 = i + 1
    local value3 = blend(i, value2)
    local value4 = i + 1
    print(i, value3, blend(value4, i))
end
