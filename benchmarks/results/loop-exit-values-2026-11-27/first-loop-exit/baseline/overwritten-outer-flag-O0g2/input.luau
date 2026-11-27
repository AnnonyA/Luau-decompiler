local function evaluate(limit)
    local flag = false
    print("before", flag)
    for index = 1, limit do
        flag = false
        flag = not flag
    end
    return flag
end
print("zero", evaluate(0))
print("three", evaluate(3))
