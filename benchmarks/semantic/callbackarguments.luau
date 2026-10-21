local function apply(callback, a, b)
    return callback(a, b)
end
local function difference(a, b) return a - b end
print(apply(difference, 8, 3))
print(apply(function(a, b) return a * b end, -2, 4))
