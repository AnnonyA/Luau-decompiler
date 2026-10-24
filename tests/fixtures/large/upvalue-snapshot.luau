local offset = 1
local function advance(count)
    local start = offset
    for _ = 1, count do
        offset += 1
    end
    return start, offset
end
for _, count in ipairs({0, 3, 1, 5}) do
    print(advance(count))
end
