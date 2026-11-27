local hits = 0
local value = setmetatable({}, {__eq = function() hits += 1; return false end})
local function factory()
    return function() return value end
end
local call = {factory}
local a = call[1]()
local b = call[1]()
print(a == b, hits)
