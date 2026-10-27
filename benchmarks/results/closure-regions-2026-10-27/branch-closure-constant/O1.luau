local first = ...
local result = first ~= "false"
local function factory()
    local function function_(seed)
        return seed + 1
    end

    return function_
end

local value2 = factory()
local result2 = if result then factory() else value2
local result3 = value2 == result2
local value3 = value2(3)
local value4: number = 7
print(result3, value3, result2(value4))
