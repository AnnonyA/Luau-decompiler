local token = {}
local function factory() return function() return token end end
local first = factory()
local second = factory()
return first == second
