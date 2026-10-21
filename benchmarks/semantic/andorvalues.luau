local function choose(a, b, c)
    return a and b, a or b, a and b or c
end
print(choose(true, false, "fallback"))
print(choose(false, "chosen", 9))
print(choose(0, "", "fallback"))
print(choose(nil, 8, 9))
