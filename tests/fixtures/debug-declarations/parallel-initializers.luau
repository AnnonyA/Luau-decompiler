local calls = 0
local function nextValue(tag)
    calls += 1
    print(tag, calls)
    return calls, "extra", nil
end
local left, right = nextValue("left"), nextValue("right")
local first, second, third = 7, 11, 13
print(left, right, first, second, third)
local saved = {}
for i = 1, 3 do
    local a, b = i, i * 2
    saved[i] = function() a += 1 return a, b end
end
print(saved[1](), saved[2](), saved[3]())
local marker, other
print(marker, other)
