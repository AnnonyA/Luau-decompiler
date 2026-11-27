local function make() return function() return 1 end end
local function left(...) return make() end
local function right(...) return make() end
local a, b = left(), right()
local keys = {[a] = "left", [b] = "right"}
print(a == left(), b == right(), a == b)
print(keys[left()], keys[right()])
