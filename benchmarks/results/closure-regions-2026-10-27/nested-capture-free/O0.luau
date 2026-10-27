local function outer()
    local function factory()
        local function function_(seed)
            return seed + 1
        end

        return function_
    end

    local value2 = factory()
    local value3 = factory()
    local result = value2 == value3
    local value4 = value2(2)
    return result, value4, value3(3)
end

local value5: number = 1
local config = { outer }
print(config[value5]())
