local calls = 0
local function make(tag)
    calls += 1
    local value = tag
    return function(first, ...)
        value += 1
        return value, first, select("#", ...), ...
    end
end

local first, second = make(7), make(17)
local proxy = setmetatable({}, {
    __index = function(_, key)
        calls += 100
        return if key == "first" then first else second
    end,
})
local function arguments()
    calls += 10
    return "a", nil, "c"
end
local function observe(label, ...)
    print(label, select("#", ...), ...)
end

observe("first", proxy.first(arguments()))
observe("second", (false or proxy.second)(arguments()))
observe("again", first(arguments()))
print("calls", calls, first == second)

local function pick(value)
    calls += 1000
    return value, second
end
observe("one callee", (pick(first))(arguments()))
local okFalse, errorFalse = pcall(function() return (pick(false))(arguments()) end)
local okNil, errorNil = pcall(function() return (pick(nil))(arguments()) end)
print("errors", okFalse, errorFalse:find("boolean") ~= nil, okNil, errorNil:find("nil") ~= nil, calls)

local captured = 0
local function increment(amount)
    captured += amount
    return captured, nil, captured + 1
end
local handlers = { increment = increment }
observe("capture", handlers.increment(3))
observe("capture again", handlers.increment(4))
print("final", captured, calls)
