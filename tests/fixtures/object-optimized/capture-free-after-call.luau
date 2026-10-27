local function factory()
    return function(value) return value + 1 end
end
print('before')
local first = factory()
local second = factory()
print(first == second, first(2), second(3))
