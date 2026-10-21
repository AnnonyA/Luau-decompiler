local function a(value) print("a", value) return value + 1 end
local function b(value) print("b", value) return value * 2 end
print(a(b(3)), b(a(4)))
