local function prune(values)
    local stack = {}
    for _, value in ipairs(values) do
        while #stack > 0 and stack[#stack] > value do
            table.remove(stack)
        end
        stack[#stack + 1] = value
    end
    return table.concat(stack, ",")
end
for _, values in ipairs({{8, 9, 10, 2, 4}, {3, 2, 1}, {1, 2, 3}, {}, {5, 5, 1}}) do
    print(prune(values))
end
