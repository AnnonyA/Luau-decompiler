local function split(text)
    local result = {}
    local start = 1
    while true do
        local finish = string.find(text, '|', start, true)
        if not finish then
            table.insert(result, string.sub(text, start))
            break
        end
        table.insert(result, string.sub(text, start, finish - 1))
        start = finish + 1
    end
    return result
end
for _, text in ipairs({'a|b|c', 'alone', '|x||', ''}) do
    local result = split(text)
    print(text, #result, table.concat(result, '/'))
end
