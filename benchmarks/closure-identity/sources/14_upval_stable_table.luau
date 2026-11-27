local value = {}
local function factory()
    return function() return value end
end
local call = {factory}
local a = call[1]()
local b = call[1]()
local keys = {[a] = "first"}
print(a == b, a() == b(), keys[b])
