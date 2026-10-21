local function run(limit)
    local count = 0
    repeat count += 1 until count >= limit
    return count
end
print(run(-1), run(0), run(1), run(5))
