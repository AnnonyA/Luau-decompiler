local value = 9
local function outer(value)
    local function inner(value) return value + 1 end
    return inner(value), value
end
print(outer(3))
print(value)
