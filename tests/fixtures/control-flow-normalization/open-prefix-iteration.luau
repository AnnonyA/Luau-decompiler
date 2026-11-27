local function tail(...)
    return ...
end

local function exercise(flag)
    print("call", if flag then "left" else "right", tail("tail", nil, 17))
    local values = { "list", if flag then "left" else "right", tail("tail", nil, 17) }
    print(values[1], values[2], values[3], values[4] == nil, values[5])
    for index, value in ipairs({ "a", "b" }) do
        print("iteration", index, value)
    end
    return "return", if flag then "left" else "right", tail("tail", nil, 17)
end

print(exercise(true))
print(exercise(false))
