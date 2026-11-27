local value = 0
local produce
function produce(value2)
    value = value + 1
    return value2, nil, value
end

local forward = function(producer, value)
    local value3 = producer(value)
    return value3
end
local inspect = function(tag, counter, ...)
    local value4 = "#"
    local value5 = ...
    local value6 = counter(value4, value5)
    return tag, value6, ...
end
local field = inspect
local field2 = forward
local print2 = print
local config = { field, field2 }
print2((if true then config[1] else nil)("empty", select))
local print3 = print
print3((if true then config[1] else nil)("nil", select, nil))
local print4 = print
print4((if true then config[1] else nil)("holes", select, 2, nil, 4, nil))
local print5 = print
local value7 = config[1]
local select2 = select
print5((if true then value7 else nil)("effect", select2, (if true then config[2] else nil)(produce, 7)))
print(value)

