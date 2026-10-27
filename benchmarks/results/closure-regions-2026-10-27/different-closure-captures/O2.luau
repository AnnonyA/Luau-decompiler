local function factory(seed)
    local function function_()
        return seed
    end

    return function_
end

local function function_2(): number
    return 3
end

local function function_3(): number
    return 7
end

local function function_4(): number
    return 3
end

local result = function_2 == function_3
local result2 = function_2 == function_4
local value2 = function_2()
local value3 = function_3()
print(result, result2, value2, value3, function_4())
