local function inspect(values)
    return #values, values[#values]
end
print(inspect({}))
print(inspect({7}))
print(inspect({2, 4, 6}))
