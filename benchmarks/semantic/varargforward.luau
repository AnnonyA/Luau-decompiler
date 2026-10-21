local function tail(...) return ... end
local function relay(prefix, ...) return prefix, tail(...) end
print(relay("one"))
print(relay("two", 1, nil, 3))
print(select("#", relay("three", nil)))
