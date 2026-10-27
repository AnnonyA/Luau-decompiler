local function factory()
    local function function_(seed)
        return seed + 1
    end

    return function_
end

print("before")
local function sharedFunction(seed)
    return seed + 1
end

local result = sharedFunction == sharedFunction
local value3 = sharedFunction(2)
local value4: number = 3
print(result, value3, sharedFunction(value4))
