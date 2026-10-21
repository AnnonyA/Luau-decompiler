local function check(x)
    if x == nil then return "missing", 0 end
    if x < 0 then return "negative", -x end
    return "accepted", x * 2
end
print(check(nil))
print(check(-3))
print(check(0))
print(check(8))
