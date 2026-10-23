local function describe(item)
    local parts = {item.name, item.digest or item.target or '', tostring(item.size), table.concat({'done'}, ',')}
    return table.concat(parts, '|')
end
for _, item in ipairs({
    {name = 'file', digest = 'abcd', size = 4},
    {name = 'link', target = '/tmp', size = 0},
    {name = 'dir', size = 0},
    {name = 'false', digest = false, target = 'backup', size = 2},
}) do
    print(describe(item))
end
