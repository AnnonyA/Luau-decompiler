local sharedFunction
local first = ...
local result = first ~= "false"
local function factory()
    local function function_(seed)
        return seed + 1
    end

    return function_
end

sharedFunction = function(seed)
    return seed + 1
end
local result2 = if result then sharedFunction else sharedFunction
local result3 = sharedFunction == result2
local value3 = sharedFunction(3)
local value4: number = 7
print(result3, value3, result2(value4))
