local calls = 0
local meta = {
    __add = function(left, right)
        print("add identity", rawequal(left, right))
        return 17
    end,
    __lt = function(left, right)
        print("less identity", rawequal(left, right))
        return rawequal(left, right)
    end,
    __eq = function(left, right)
        print("equal callback", rawequal(left, right))
        return false
    end,
    __index = function(object, key)
        print("index identity", rawequal(object, key))
        return 23
    end,
    __newindex = function(object, key, value)
        print("store identity", rawequal(object, key), rawequal(object, value))
        rawset(object, key, value)
    end,
}
local factories = {function()
    calls += 1
    return setmetatable({}, meta), nil, "tail", nil
end}

local value = factories[1]()
value = value + value
print("sum", value, calls)

value = factories[1]()
value = value < value
print("less", value, calls)

value = factories[1]()
value = value == value
print("equal", value, calls)

value = factories[1]()
value = value[value]
print("lookup", value, calls)

value = factories[1]()
value[value] = value
print("stored", calls)

local function observe(...)
    print("arity", select("#", ...))
    local object, second, third, fourth = ...
    print("pack", type(object), second == nil, third, fourth == nil)
end
observe(factories[1]())
print("closed counter", calls)
