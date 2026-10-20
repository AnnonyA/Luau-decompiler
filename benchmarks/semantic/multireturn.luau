local function triple()
    return 3, 5, 7
end
local function swap(left, right)
    return right, left
end
local a, b, c = triple()
print("multireturn", a, b, c)
print("forward", swap(9, 4))
