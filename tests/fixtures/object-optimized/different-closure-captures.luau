local function factory(value)
    return function() return value end
end
local first = factory(3)
local second = factory(7)
local third = factory(3)
print(first == second, first == third, first(), second(), third())
