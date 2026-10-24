local function magnitude(a, b)
    local delta = a - b
    return delta * delta + delta
end
local function interpolate(a, b, t)
    return a + (b - a) * t
end
local function sample(values, count)
    local distances, total = {0}, 0
    for i, value in ipairs(values) do
        total += math.sqrt(magnitude(value, values[i % #values + 1]))
        distances[i + 1] = total
    end
    local out, edge = {}, 1
    for i = 0, count - 1 do
        local target = i * total / count
        while edge < #values and distances[edge + 1] < target do edge += 1 end
        local width = distances[edge + 1] - distances[edge]
        local t = width > 0.000001 and (target - distances[edge]) / width or 0
        out[#out + 1] = interpolate(values[edge], values[edge % #values + 1], t)
    end
    return table.concat(out, ","), total
end
for _, count in ipairs({0, 1, 4, 12}) do
    print(sample({1, 4, 9, 16}, count))
    print(sample({2, 2, 2}, count))
end
