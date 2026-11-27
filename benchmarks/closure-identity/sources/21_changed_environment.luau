local output = print
local function factory()
    return function() return 1 end
end
_G.setfenv(1, {})
local first = factory()
local second = factory()
local values = {[first] = "first"}
values[second] = "second"
output(first == second, values[first], values[second])
