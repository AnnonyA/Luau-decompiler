local function many(label)
    print(label)
    return 3, nil, 9
end
local a, b, c, d = many("first"), 5, many("last")
print(a, b, c, d)
local x, y = (many("clipped")), (many("clipped2"))
print(x, y, select("#", x, y))
local p, q, r
p, q, r = 7, nil, 11
print(p, q, r)
local cases = {}
for i = 1, 3 do
    local value, next = i, i + 1
    cases[i] = function() value += next return value, next end
end
print(cases[1](), cases[2](), cases[1]())
