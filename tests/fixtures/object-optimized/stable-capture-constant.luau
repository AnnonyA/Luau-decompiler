local config = {bias = 7}
local function factory()
    return function(value) return value + config.bias, config end
end
local first = factory()
local second = factory()
local result, alias = first(3)
config.bias = 9
local nextResult, nextAlias = second(4)
print(first == second, result, alias == config, nextResult, nextAlias == config)
