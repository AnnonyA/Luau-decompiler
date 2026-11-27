local function factory() return function() end end
local first = factory()
local second = factory()
return first == second
