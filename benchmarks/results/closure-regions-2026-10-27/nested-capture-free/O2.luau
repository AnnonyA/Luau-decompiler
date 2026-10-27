local function outer()
    local function factory()
        local function function_(seed)
            return seed + 1
        end

        return function_
    end

    local function sharedFunction(seed)
        return seed + 1
    end

    local result = sharedFunction == sharedFunction
    local value3 = sharedFunction(2)
    return result, value3, sharedFunction(3)
end

local config = { outer }
print(config[1]())
