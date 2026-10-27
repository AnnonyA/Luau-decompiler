local argument = ...
local value = tonumber(argument) or 0
local zero = value - value
local captured = zero / zero
local function factory()
    return function() return captured end
end
local first = factory()
local second = factory()
print(first == second, first() ~= first(), second() ~= second())
