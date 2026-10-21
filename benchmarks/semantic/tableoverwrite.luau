local function make(x)
    local data = {a = x, b = 2}
    data.a = x + 1
    data.b += 3
    return data.a, data.b
end
print(make(0))
print(make(5))
