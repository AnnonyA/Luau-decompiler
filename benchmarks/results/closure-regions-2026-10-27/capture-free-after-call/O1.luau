local function factory()
    local function function_(seed)
        return seed + 1
    end

    return function_
end

print("before")
local value2 = factory()
local value3 = factory()
local result = value2 == value3
local value4 = value2(2)
local value5: number = 3
print(result, value4, value3(value5))
