local function factory() return function() end end
local a = factory()
local call = {factory}
local b = call[1]()
local keys = {[a] = "inline", [b] = "factory"}
print(a == b, b == call[1](), a == factory())
print(keys[a], keys[b])
