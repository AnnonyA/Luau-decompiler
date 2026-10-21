local function compute(flag, x)
    local result = x
    if flag then
        result = result + 7
    else
        result = result * 3
    end
    return result + 1
end
print(compute(true, 2), compute(false, 2), compute(true, -7), compute(false, 0))
