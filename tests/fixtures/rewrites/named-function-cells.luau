local argument = ...
local limit = tonumber(argument) or 4
local current
local function reader()
    return current
end
local function invoke(value)
    return current(value)
end
current = function(value)
    if value <= 0 then
        return "initial", value
    end
    return current(value - 1)
end
local first = reader()
print("before", reader() == current, invoke(limit))
current = function(value)
    return "replacement", value * 3
end
print("after", reader() == current, reader() == first, invoke(limit))
print("old", first(limit))
local function makeCounter()
    local count = 0
    local nextValue
    local function callback()
        return nextValue()
    end
    nextValue = function()
        count += 1
        return count, callback
    end
    return callback
end
local left, right = makeCounter(), makeCounter()
local count, identity = left()
local rightCount, rightIdentity = right()
print("cells", left == right, identity == left, count, left(), rightCount, rightIdentity == right)
