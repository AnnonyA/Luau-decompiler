local function factory() return function() end end
local a = factory()
local indirect = {factory}
local b = indirect[1]()
local index = {[a] = "direct", [b] = "indirect"}
print(a == b, b == indirect[1](), a == factory())
print(index[a], index[b], index[indirect[1]()], index[factory()])
