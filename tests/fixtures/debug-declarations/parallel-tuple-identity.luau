local entries = {2, nil, 4, 8, nil, 16}
local function grab(start)
    return table.unpack(entries, start, start + 2)
end
local a, b, c = grab(1)
local d, e, f = grab(4)
local function observe()
    a += 1
    return a, b, c, d, e, f
end
print(select("#", observe()), observe())
print(observe())
local second = {}
for i = 1, 2 do
    local x, y, z = grab(1)
    second[i] = function() x += i return x, y, z end
end
print(second[1](), second[2](), second[1]())
