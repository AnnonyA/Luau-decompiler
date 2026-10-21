local function equality(a, b)
    return a == b, a ~= b
end
print(equality(1, "1"))
print(equality(false, nil))
print(equality(nil, nil))
print(equality("a", "a"))
print(equality("a", "b"))
