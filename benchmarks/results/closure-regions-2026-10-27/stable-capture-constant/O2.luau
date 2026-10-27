local config = { bias = 7 }
local function factory()
    local function_
    function_ = function(seed)
        return seed + config.bias, config
    end
    return function_
end

local function sharedFunction(seed)
    return seed + config.bias, config
end

local result, value3 = sharedFunction(3)
config.bias = 9
local result2, value4 = sharedFunction(4)
local result3 = sharedFunction == sharedFunction
local result4 = value3 == config
local result5 = value4 == config
print(result3, result, result4, result2, result5)
