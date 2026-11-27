local outer = 10
local calls = 0
local function observe(tag, value)
    calls += 1
    print(tag, calls, value)
    return value, nil, "tail"
end
local result = {}
do
    local outer, right = observe("first", outer), observe("second", outer)
    result[1] = function() outer += 1 return outer, right end
end
local captured = 4
local first, getter = captured, function() return captured end
captured = 9
print(result[1](), result[1](), outer, first, getter())
local left = 23
local function flags(...)
    local a, b, c = ..., select(2, ...), select(3, ...)
    return a, b, c, select("#", ...)
end
print(flags(nil, 17, nil, 29))
local x = observe("x", 3)
local y = observe("y", x)
print(x, y)
