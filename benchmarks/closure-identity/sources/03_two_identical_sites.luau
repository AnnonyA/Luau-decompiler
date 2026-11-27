local a = function() return 1 end
local b = function() return 1 end
local keys = {[a] = "first"}
print(a == b, keys[b])
keys[b] = "second"
print(keys[a], keys[b])
