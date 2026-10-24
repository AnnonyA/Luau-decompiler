local function walk(candidates, maxSteps)
    local used, path = {}, {}
    for step = 1, maxSteps do
        local selected = nil
        local prefix = if step % 2 == 0 then 10 else 20
        for _, candidate in ipairs(candidates) do
            if not used[candidate] then
                selected = candidate
                break
            end
        end
        if not selected then break end
        used[selected] = true
        path[#path + 1] = selected + prefix
    end
    return table.concat(path, ",")
end
for _, values in ipairs({{}, {4}, {3, 3, 1, 5}, {0, 8, 2}}) do
    for _, limit in ipairs({0, 1, 3, 6}) do print(walk(values, limit)) end
end
