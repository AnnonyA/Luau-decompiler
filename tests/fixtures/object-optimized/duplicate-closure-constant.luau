local function factory()
    return function(value)
        return value + 1
    end
end
local first = factory()
local second = factory()
print(first == second, first(3), second(7))
