local config = {bias = 1}
local function factory()
    return function() return config end
end
_G.setfenv(1, setmetatable({}, {__index = _G.getfenv()}))
local first = factory()
local second = factory()
print(first == second, first() == config, second() == config)
