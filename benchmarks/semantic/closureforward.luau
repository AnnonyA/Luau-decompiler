local odd
local function even(n)
    if n == 0 then return true end
    return odd(n - 1)
end
odd = function(n)
    if n == 0 then return false end
    return even(n - 1)
end
print(even(0), even(4), even(5), odd(0), odd(3))
