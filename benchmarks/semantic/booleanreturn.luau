local function bool(a, b)
    return not a, not not a, not (a and b), not (a or b)
end
print(bool(nil, true))
print(bool(false, 0))
print(bool(0, false))
print(bool("", "value"))
