local function outer()
    local function factory()
        return function(value) return value + 1 end
    end
    local first = factory()
    local second = factory()
    return first == second, first(2), second(3)
end
local functions = {outer}
print(functions[1]())
