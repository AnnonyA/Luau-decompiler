local function weighted(value)
    return (value + 1) * 2 + 3
end
local first = ...
local limit = tonumber(first) or 3
for index = -3, limit do
    local offset = index
    local shifted = offset + 1
    do
        local offset = index + 100
        print("block", shifted * 2 + 3, offset)
    end
    for offset = 100, 101 do
        print("loop", shifted * 2 + 3, offset)
    end
    for offset, marker in {11, 13} do
        print("iterator", shifted * 2 + 3, offset, marker)
    end
    local offset, score = 100, shifted * 2 + 3
    print("initializer", score, offset, weighted(index))
end
print("complete", limit)
