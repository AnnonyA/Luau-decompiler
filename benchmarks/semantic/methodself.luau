local object = {value = 7}
function object:add(x) return self.value + x end
print(object:add(2), object.add(object, -3))
local method = object.add
print(method({value = 10}, 5))
