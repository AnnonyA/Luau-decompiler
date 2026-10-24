local function inventory(items)
    local result = {version = 1, entries = {}, index = {}, chunks = {}}
    local identity = {}
    local nextIdentity = 1
    for _, item in ipairs(items) do
        if not identity[item.id] then
            identity[item.id] = nextIdentity
            nextIdentity += 1
            result.index[item.id] = identity[item.id]
            result.chunks[item.id] = item.text
        end
        table.insert(result.entries, item.id)
    end
    print(nextIdentity, #result.entries, result.chunks.a, result.chunks.b, result.index.a, result.index.b)
end
inventory({{id='a', text='alpha'}, {id='b', text='beta'}, {id='a', text='unused'}})
inventory({{id='b', text='other'}})
