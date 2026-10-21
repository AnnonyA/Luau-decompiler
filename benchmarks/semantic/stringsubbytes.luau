local function slice(value)
    return string.sub(value, 2, -2), string.byte(value, 1), string.len(value)
end
print(slice("abcde"))
print(slice("x"))
print(slice(""))
