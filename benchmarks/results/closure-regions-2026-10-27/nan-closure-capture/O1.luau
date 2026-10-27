local first = ...
local captured = ((tonumber(first) or 0) - (tonumber(first) or 0)) / ((tonumber(first) or 0) - (tonumber(first) or 0))
local function factory()
    local function_
    function_ = function()
        return captured
    end
    return function_
end

local value = factory()
local value2 = factory()
local result = value == value2
local value3 = value()
local result2 = value3 ~= value()
local value4 = value2()
value3 = value4 ~= value2()
print(result, result2, value3)
