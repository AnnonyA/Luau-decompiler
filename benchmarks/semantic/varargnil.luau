local function inspect(...)
    return select("#", ...), select(2, ...)
end
print(inspect(1, nil, 3, nil))
print(inspect(1, 2))
