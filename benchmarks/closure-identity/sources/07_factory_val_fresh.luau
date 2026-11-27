local function factory(value)
    return function() return value end
end
local call = {factory}
local a = call[1](1)
local b = call[1](1)
local c = call[1](2)
local keys = {[a] = "first"}
print(a == b, a(), b(), c(), keys[b])
