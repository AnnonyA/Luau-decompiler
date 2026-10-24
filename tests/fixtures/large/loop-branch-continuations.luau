local function run(limit, stop)
    local sum, count = 0, 0
    local reason = "complete"
    for i = 1, 7 do
        if count >= limit or sum >= stop then
            reason = count >= limit and "count" or "sum"
            break
        end
        if i % 2 == 0 then sum += i end
        count += 1
    end
    return sum, count, reason
end
for _, limit in ipairs({0, 1, 4, 20}) do
    for _, stop in ipairs({0, 3, 100}) do print(limit, stop, run(limit, stop)) end
end
