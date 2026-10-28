local function band(value)
    if value < -2 then
        return value * 3 - 1
    elseif value > 4 then
        return value * 7 + 2
    end
    return value * value + 5
end
local function shifted(value)
    local adjusted = value * 3 + 1
    return if adjusted < 0 then -adjusted + 2 else adjusted * 7
end
local function inside(value)
    return if value < -2 then value * value < 49 else value * 3 + 1 <= 10
end
local first = ...
local limit = tonumber(first) or 8
local sum = 0
for index = -5, limit do
    local firstResult = band(index)
    local secondResult = shifted(index)
    sum += firstResult + secondResult
    print(index, firstResult, secondResult, inside(index))
end
print("total", sum)
