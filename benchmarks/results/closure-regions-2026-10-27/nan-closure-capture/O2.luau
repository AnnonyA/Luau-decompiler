local first = ...
local value = ((tonumber(first) or 0) - (tonumber(first) or 0)) / ((tonumber(first) or 0) - (tonumber(first) or 0))
local function factory()
    local function_
    function_ = function()
        return value
    end
    return function_
end

local function function_2()
    return value
end

local function function_3()
    return value
end

local result = function_2 == function_3
local value2 = function_2()
local result2 = value2 ~= function_2()
local value3 = function_3()
value2 = value3 ~= function_3()
print(result, result2, value2)
