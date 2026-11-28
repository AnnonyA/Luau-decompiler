local function choose(value, limit, step)
    for i = 1, limit, step do
        return value + i
    end
    return -7
end

local function observe(value, limit, step)
    local key = choose(value, limit, step)
    local result = {}
    result[key] = value
    return key, result[key]
end

print(observe(41, 4, 1))
print(observe(41, 0, 1))
print(observe(41, 4, -1))
print(observe(41, -2, -1))
print(observe(41, 0/0, 1))
