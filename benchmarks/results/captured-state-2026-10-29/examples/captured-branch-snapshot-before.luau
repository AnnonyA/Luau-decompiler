local function scenario(i2, index: boolean)
    local value2 = i2
    local read
    read = function()
        return value2
    end
    if index then
        local snapshot = value2
        value2 = i2 + 3
    else
        local snapshot2 = value2
        value2 = i2 - 2
    end
    return value2, value2, value2
end

local first = ...
local _ = tonumber
local value3 = tonumber(first) or 5
local _2 = value3 + 3
for i = value3, value3 + 3 do
    local value4: boolean = true
    print("true", scenario(i, value4))
    local value5: boolean = false
    print("false", scenario(i, value5))
end
