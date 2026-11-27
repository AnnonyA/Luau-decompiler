local function advance(value, maxSteps)
    local count = 0
    local events = {}
    while true do
        if value >= 12 then
            break
        end
        if count >= maxSteps then
            table.insert(events, "capped")
            break
        end
        value = if value % 2 == 0 then value + 3 else value + 1
        count += 1
    end
    return value, count, table.concat(events, ",")
end

print(advance(0, 8))
print(advance(0, 1))
print(advance(13, 8))
