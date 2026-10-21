local function read(value)
    print("read", value)
    return value
end
local function combine(a, b, c)
    print("combine", a, b, c)
    return a + b + c
end
print(combine(read(1), read(2), read(3)))
