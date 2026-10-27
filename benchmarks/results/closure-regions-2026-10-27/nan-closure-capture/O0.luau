local first = ...
local result: number? = tonumber(first)
if not result then
    result = 0
end
local captured = (result - result) / (result - result)
local function factory()
    local function_
    function_ = function()
        return captured
    end
    return function_
end

local value = factory()
local value2 = factory()
local result2 = value == value2
local value3 = value()
local result3 = value3 ~= value()
local value4 = value2()
value3 = value4 ~= value2()
print(result2, result3, value3)
