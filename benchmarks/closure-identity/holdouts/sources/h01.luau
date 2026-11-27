local output = print
local changeEnvironment = _G.setfenv
local readEnvironment = _G.getfenv
local function make()
    return function() return heldToken end
end
local first = make()
local initialEnvironment = readEnvironment(first)
changeEnvironment(first, {heldToken = "detached"})
local detachedValue = first()
local second = make()
local third = make()
changeEnvironment(first, initialEnvironment)
local fourth = make()
local keys = {[first] = "first", [second] = "second", [third] = "third"}
output(first == second, second == third, first == fourth)
output(keys[first], keys[second], keys[third], keys[fourth])
output(detachedValue, second(), third(), fourth())
