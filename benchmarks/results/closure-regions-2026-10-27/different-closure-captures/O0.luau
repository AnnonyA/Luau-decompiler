local function factory(seed: number)
    local function function_(): number
        return seed
    end

    return function_
end

local value2 = factory(3)
local value3 = factory(7)
local value4 = factory(3)
local result = value2 == value3
local result2 = value2 == value4
local value5 = value2()
local value6 = value3()
print(result, result2, value5, value6, value4())
