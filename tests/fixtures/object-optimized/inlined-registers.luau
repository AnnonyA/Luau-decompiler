local function step(value, amount)
    local result = value + amount
    if result > 10 then
        return result - 10
    end
    return result * 2
end
local function run(value)
    local first = step(value, 3)
    local object = { first = first }
    local second = step(value, 7)
    object.second = second
    return object.first, object.second, first + second
end
print(run(1))
print(run(5))
print(run(12))
