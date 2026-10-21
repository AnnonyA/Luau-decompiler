local function outer(a)
    return function(b)
        return function(c) return a + b * c end
    end
end
local add = outer(2)(3)
local other = outer(-1)(4)
print(add(0), add(5), other(2))
