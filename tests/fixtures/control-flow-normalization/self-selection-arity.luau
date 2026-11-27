local calls = 0
local producers = {function(value)
    calls += 1
    return value, nil, "extra", nil
end}
local function observe(...)
    print("values", select("#", ...), ...)
end
local function selected(value)
    local first = producers[1](value)
    first = first and first
    local second = producers[1](value)
    second = second or second
    return first, second, nil
end
observe(selected(false))
observe(selected(0))
observe(selected("text"))
observe(producers[1]("open"))
print("captured calls", calls)

local factories = {function()
    calls += 1
    return -calls, "discarded"
end}
print("fastcall", math.abs(factories[1]()), calls)
