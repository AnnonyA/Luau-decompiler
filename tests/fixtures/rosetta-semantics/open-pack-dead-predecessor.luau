local calls = 0
local function produce(value)
    calls += 1
    return value, nil, calls
end
local function forward(producer, value)
    return producer(value)
end
local function inspect(tag, counter, ...)
    local count = counter("#", ...)
    return tag, count, ...
end
local helpers = {inspect, forward}

print(helpers[1]("empty", select))
print(helpers[1]("nil", select, nil))
print(helpers[1]("holes", select, 2, nil, 4, nil))
print(helpers[1]("effect", select, helpers[2](produce, 7)))
print(calls)
