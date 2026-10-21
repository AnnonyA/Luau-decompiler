local function key(name)
    print("key", name)
    return name
end
local function value(number)
    print("value", number)
    return number
end
local data = {[key("a")] = value(1), [key("b")] = value(2)}
print(data.a, data.b)
