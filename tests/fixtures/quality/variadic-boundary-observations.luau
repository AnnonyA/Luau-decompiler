local trace = {}
local function effect(label, ...)
    table.insert(trace, label)
    return ...
end
local function identity(value) return value end
local function choose(first, second)
    local value = first and second
    if value then return value, nil, false end
    return nil, true, false
end
local function arithmetic(left, right)
    local doubled = left + left
    return doubled + right
end
local function constant() return 9, nil, false end
local function pack(...) return select("#", ...), ... end
local function variadic(...)
    table.insert(trace, debug.info(1, "n"))
    return ...
end
print(pack(identity(effect("empty"))))
print(pack(identity(effect("many", nil, 2, 3))))
print(pack(choose(effect("left", false), effect("right", 7))))
print(pack(choose(effect("truthy", 0), effect("value", "ok"))))
print(arithmetic(3, 4), arithmetic(-0, 0 / 0))
print(pack(constant(effect("unused1", 1), effect("unused2", 2))))
local alias = identity
print(pack(alias(effect("alias", false, 3))))
print(pack(variadic(effect("vararg", nil, 3, nil))))
local state = "before"
local function captured() return state end
local before = captured()
state = "after"
print(before, captured())
local function increment(value) return value + 1 end
local proxy = setmetatable({}, { __add = function()
    table.insert(trace, debug.info(2, "n"))
    return 41
end })
print((true and increment)(proxy), increment(4))
local function factory(value)
    return function() return value end
end
local first, second = factory({}), factory({})
print(first == second, first() == second())
print(table.concat(trace, ","))
