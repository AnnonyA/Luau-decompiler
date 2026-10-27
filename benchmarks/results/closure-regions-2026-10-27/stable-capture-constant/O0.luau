local config = { ["bias"] = 7 }
local function factory()
    local function_
    function_ = function(seed)
        return seed + config.bias, config
    end
    return function_
end

local value2 = factory()
local value3 = factory()
local result, value4 = value2(3)
config.bias = 9
local result2, value5 = value3(4)
local result3 = value2 == value3
local result4 = value4 == config
local result5 = value5 == config
print(result3, result, result4, result2, result5)
