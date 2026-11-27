local made = 0
local factories = {function(value)
    made += 1
    return {value = value}
end}
local function observe(offset)
    local object = factories[1](offset)
    local alias = object
    object.value += 3
    return object, alias, object.value, function() return object end
end
local observers = {observe}
local first, second, value, capture = observers[1](4)
print(first == second, capture() == first, first.value, value, made)
