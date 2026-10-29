local function scenario(i2, index: boolean)
    local value2 = i2
    local read
    read = function()
        return value2
    end
    local snapshot = value2
    value2 = if index then i2 + 3 else i2 - 2
    return snapshot, value2, value2
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
