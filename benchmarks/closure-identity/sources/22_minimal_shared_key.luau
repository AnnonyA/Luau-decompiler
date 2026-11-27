local function factory() return function() end end
local first = factory()
local keys = {[first] = "hit"}
local second = factory()
print(first == second, keys[second])
