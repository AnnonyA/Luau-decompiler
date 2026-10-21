local function run(first, last)
    local times = 0
    local final = 99
    for i = first, last do
        times += 1
        final = i
    end
    return times, final
end
print(run(4, 3))
print(run(4, 4))
print(run(-2, 2))
