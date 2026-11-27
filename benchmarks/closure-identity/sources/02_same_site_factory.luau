local function factory()
    return function() return 1 end
end
local call = {factory}
local a = call[1]()
local b = call[1]()
local keys = {[a] = "first"}
print(a == b, keys[b])
keys[b] = "second"
print(keys[a], keys[b])
