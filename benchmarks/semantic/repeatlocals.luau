local function run(limit)
    local n = 0
    repeat
        n += 1
        local finished = n >= limit
    until finished
    return n
end
print(run(0), run(1), run(4))
